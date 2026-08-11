"""Instagram OAuth client — the external-IO seam (architecture.md §3.4).

The OAuth handshake is defined behind an :class:`InstagramClient` protocol so
the flow is fully testable with a fake; the real :class:`HttpInstagramClient`
talks to Meta over ``httpx``. Tests swap the implementation via FastAPI
``dependency_overrides`` on :func:`get_instagram_client`.

Token storage rule (§10.5): the **short-lived** token from the initial
``code → access_token`` exchange is NEVER persisted — it lives only in the
callback handler's memory and is immediately exchanged for a long-lived token.
Only the long-lived token is persisted (encrypted) by the caller.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Protocol, runtime_checkable
from urllib.parse import urlencode

import httpx

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException

# Instagram account types that may grant the business scopes Buzz needs.
ALLOWED_ACCOUNT_TYPES = frozenset({"BUSINESS", "CREATOR"})


def canonical_instagram_handle(username: str | None) -> str:
    """Normalize an IG username for display/storage (no leading ``@``, stripped).

    Org portal identity is ``users.instagram_username``; use this when projecting
    that value as a wire ``instagram_handle``.
    """

    return (username or "").strip().lstrip("@")


def require_instagram_handle(username: str | None) -> str:
    """Like :func:`canonical_instagram_handle`, but reject empty usernames."""

    handle = canonical_instagram_handle(username)
    if not handle:
        raise BuzzAPIException(
            code=errors.INVALID_ONBOARDING_STATE,
            message="Instagram username is missing from your login account.",
            status_code=400,
        )
    return handle


@dataclass(frozen=True)
class ShortLivedToken:
    """Result of the ``code → access_token`` exchange (never persisted)."""

    access_token: str
    user_id: str


@dataclass(frozen=True)
class LongLivedToken:
    """Result of the short→long exchange; ``expires_in`` is seconds (~60d)."""

    access_token: str
    expires_in: int


@dataclass(frozen=True)
class InstagramProfile:
    """``/me`` profile used to gate Personal accounts (§3.4).

    ``followers_count`` is ``None`` when Graph omits/nulls the key so jobs can
    carry prior ``organizations.follower_count`` (distinct from a present ``0``).
    """

    id: str
    username: str
    account_type: str
    followers_count: int | None = None


@dataclass(frozen=True)
class MediaRef:
    """Lightweight ``/me/media`` discovery row (§10.1): id + post time."""

    id: str
    timestamp: str  # ISO-8601 from Instagram


@dataclass(frozen=True)
class MediaFields:
    """Basic fields for one media item (§10.1).

    ``like_count`` / ``comments_count`` are ``None`` when Graph omits the key
    (distinct from a present ``0``) so metric_sync can carry prior DB values.
    """

    id: str
    caption: str
    media_type: str
    media_product_type: str
    permalink: str
    thumbnail_url: str | None
    media_url: str | None
    timestamp: str
    like_count: int | None
    comments_count: int | None


def _optional_int_field(body: dict[str, object], key: str) -> int | None:
    """Parse an int Graph field; ``None`` when the key is absent or null."""

    if key not in body:
        return None
    raw = body[key]
    if raw is None:
        return None
    # Same cast style as ``_parse_insight_value`` (non-fractional).
    return int(float(raw))  # type: ignore[arg-type]


@runtime_checkable
class InstagramClient(Protocol):
    """The IG operations Buzz needs (OAuth + Stage 8 sync). HTTP + fakes."""

    def build_authorize_url(self, state: str) -> str: ...

    async def exchange_code(self, code: str) -> ShortLivedToken: ...

    async def exchange_for_long_lived(self, short_token: str) -> LongLivedToken: ...

    async def fetch_profile(self, long_token: str) -> InstagramProfile: ...

    # --- Stage 8 (§10.1 metric sync / §10.5 token refresh) ---
    async def refresh_long_lived(self, long_token: str) -> LongLivedToken: ...

    async def fetch_user_media(
        self, long_token: str, *, limit: int = 50, max_pages: int = 10
    ) -> list[MediaRef]: ...

    async def fetch_media(self, long_token: str, media_id: str) -> MediaFields: ...

    async def fetch_media_insights(
        self, long_token: str, media_id: str, *, is_reel: bool = False
    ) -> dict[str, int | float]: ...


def _ig_error(message: str) -> BuzzAPIException:
    # Generic 401 — never echo request params (they carry ``client_secret``).
    return BuzzAPIException(code=errors.UNAUTHORIZED, message=message, status_code=401)


# FEED (and non-reel) insights — profile_* / follows are FEED/STORY-only on Graph.
_FEED_INSIGHT_METRICS = (
    "reach,views,saved,shares,reposts,total_interactions," "profile_visits,profile_activity,follows"
)
# REELS — do not request profile_visits/profile_activity/follows (#100 on REELS).
_REEL_INSIGHT_METRICS = (
    "reach,views,saved,shares,reposts,total_interactions,"
    "ig_reels_avg_watch_time,ig_reels_video_view_total_time,reels_skip_rate"
)
_FRACTIONAL_INSIGHTS = frozenset({"reels_skip_rate"})
# Bound discovery runtime: 10 pages × default limit 50 = 500 media ids max.
_MEDIA_LIST_MAX_PAGES = 10
_MEDIA_LIST_WINDOW_DAYS = 30


def _parse_insight_value(name: str, raw: object) -> int | float:
    """Cast Graph insight values; keep fractional metrics as floats."""

    if name in _FRACTIONAL_INSIGHTS:
        return float(raw)  # type: ignore[arg-type]
    # int(float(...)) so "3.0" and 3 both work without truncating via int("3.0").
    return int(float(raw))  # type: ignore[arg-type]


def _parse_media_timestamp(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        try:
            return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S%z")
        except ValueError:
            return None


class HttpInstagramClient:
    """Real client hitting the configured Instagram/Graph endpoints.

    Reuses a single pooled ``httpx.AsyncClient`` across calls (one TLS pool for
    all three OAuth round-trips, and across logins) instead of opening a fresh
    connection per request. An injected client is owned by the caller; a
    lazily-created one is closed via :meth:`aclose` (wired to the app lifespan).
    """

    def __init__(self, http: httpx.AsyncClient | None = None) -> None:
        self._http = http
        self._owns_client = http is None
        self._lazy: httpx.AsyncClient | None = None

    async def _client(self) -> httpx.AsyncClient:
        if self._http is not None:
            return self._http
        if self._lazy is None:
            self._lazy = httpx.AsyncClient(timeout=10.0)
        return self._lazy

    async def aclose(self) -> None:
        """Close the lazily-created pooled client (no-op for injected ones)."""

        if self._owns_client and self._lazy is not None:
            await self._lazy.aclose()
            self._lazy = None

    def build_authorize_url(self, state: str) -> str:
        query = urlencode(
            {
                "client_id": settings.INSTAGRAM_CLIENT_ID,
                "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
                "scope": settings.INSTAGRAM_SCOPES,
                "response_type": "code",
                "state": state,
            }
        )
        return f"{settings.INSTAGRAM_AUTHORIZE_URL}?{query}"

    async def exchange_code(self, code: str) -> ShortLivedToken:
        client = await self._client()
        try:
            resp = await client.post(
                settings.INSTAGRAM_TOKEN_URL,
                data={
                    "client_id": settings.INSTAGRAM_CLIENT_ID,
                    "client_secret": settings.INSTAGRAM_CLIENT_SECRET,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
                    "code": code,
                },
            )
            resp.raise_for_status()
            body = resp.json()
        except httpx.HTTPError:
            raise _ig_error("Instagram code exchange failed.") from None

        access_token = body.get("access_token")
        user_id = body.get("user_id")
        if not access_token or user_id is None:
            raise _ig_error("Instagram code exchange returned no token.")
        return ShortLivedToken(access_token=str(access_token), user_id=str(user_id))

    async def exchange_for_long_lived(self, short_token: str) -> LongLivedToken:
        client = await self._client()
        try:
            resp = await client.get(
                f"{settings.INSTAGRAM_GRAPH_BASE}/access_token",
                params={
                    "grant_type": "ig_exchange_token",
                    "client_secret": settings.INSTAGRAM_CLIENT_SECRET,
                    "access_token": short_token,
                },
            )
            resp.raise_for_status()
            body = resp.json()
        except httpx.HTTPError:
            raise _ig_error("Instagram long-lived token exchange failed.") from None

        access_token = body.get("access_token")
        expires_in = body.get("expires_in")
        if not access_token or expires_in is None:
            raise _ig_error("Instagram long-lived exchange returned no token.")
        return LongLivedToken(access_token=str(access_token), expires_in=int(expires_in))

    async def fetch_profile(self, long_token: str) -> InstagramProfile:
        client = await self._client()
        try:
            resp = await client.get(
                f"{settings.INSTAGRAM_GRAPH_BASE}/me",
                params={
                    "fields": "id,username,account_type,followers_count",
                    "access_token": long_token,
                },
            )
            resp.raise_for_status()
            body = resp.json()
        except httpx.HTTPError:
            raise _ig_error("Instagram profile lookup failed.") from None

        if not body.get("id") or not body.get("account_type"):
            raise _ig_error("Instagram profile lookup returned no account.")
        return InstagramProfile(
            id=str(body["id"]),
            username=str(body.get("username", "")),
            account_type=str(body["account_type"]),
            followers_count=_optional_int_field(body, "followers_count"),
        )

    # --- Stage 8: media sync (§10.1) + token refresh (§10.5) -----------------

    async def refresh_long_lived(self, long_token: str) -> LongLivedToken:
        client = await self._client()
        try:
            resp = await client.get(
                f"{settings.INSTAGRAM_GRAPH_BASE}/refresh_access_token",
                params={"grant_type": "ig_refresh_token", "access_token": long_token},
            )
            resp.raise_for_status()
            body = resp.json()
        except httpx.HTTPError:
            raise _ig_error("Instagram token refresh failed.") from None

        access_token = body.get("access_token")
        expires_in = body.get("expires_in")
        if not access_token or expires_in is None:
            raise _ig_error("Instagram token refresh returned no token.")
        return LongLivedToken(access_token=str(access_token), expires_in=int(expires_in))

    async def fetch_user_media(
        self, long_token: str, *, limit: int = 50, max_pages: int = _MEDIA_LIST_MAX_PAGES
    ) -> list[MediaRef]:
        """List recent media, following ``paging.next`` up to ``max_pages``.

        Assumes Graph returns newest-first. Stops early when a page's items all
        fall outside the 30-day discovery window. Caps pages to bound runtime
        (default 10 × limit).
        """

        client = await self._client()
        window_start = datetime.now(timezone.utc) - timedelta(days=_MEDIA_LIST_WINDOW_DAYS)
        out: list[MediaRef] = []
        url: str | None = f"{settings.INSTAGRAM_GRAPH_BASE}/me/media"
        params: dict[str, str | int] | None = {
            "fields": "id,timestamp",
            "limit": limit,
            "access_token": long_token,
        }

        for _ in range(max_pages):
            if url is None:
                break
            try:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                body = resp.json()
            except httpx.HTTPError:
                raise _ig_error("Instagram media list failed.") from None

            page_refs: list[MediaRef] = []
            page_has_in_window = False
            for m in body.get("data", []):
                if not m.get("id"):
                    continue
                ts_raw = str(m.get("timestamp", ""))
                posted = _parse_media_timestamp(ts_raw)
                ref = MediaRef(id=str(m["id"]), timestamp=ts_raw)
                page_refs.append(ref)
                if posted is not None:
                    if posted.tzinfo is None:
                        posted = posted.replace(tzinfo=timezone.utc)
                    if posted >= window_start:
                        page_has_in_window = True

            out.extend(page_refs)
            # Newest-first: if nothing on this page is in-window, older pages won't be.
            if not page_has_in_window and page_refs:
                break

            next_url = (body.get("paging") or {}).get("next")
            url = str(next_url) if next_url else None
            params = None  # next URL already carries query params

        return out

    async def fetch_media(self, long_token: str, media_id: str) -> MediaFields:
        client = await self._client()
        fields = (
            "like_count,comments_count,caption,media_type,media_product_type,"
            "permalink,thumbnail_url,media_url,timestamp"
        )
        try:
            resp = await client.get(
                f"{settings.INSTAGRAM_GRAPH_BASE}/{media_id}",
                params={"fields": fields, "access_token": long_token},
            )
            resp.raise_for_status()
            b = resp.json()
        except httpx.HTTPError:
            raise _ig_error("Instagram media fetch failed.") from None

        return MediaFields(
            id=str(b.get("id", media_id)),
            caption=str(b.get("caption", "")),
            media_type=str(b.get("media_type", "IMAGE")),
            media_product_type=str(b.get("media_product_type", "FEED")),
            permalink=str(b.get("permalink", "")),
            thumbnail_url=b.get("thumbnail_url"),
            media_url=b.get("media_url"),
            timestamp=str(b.get("timestamp", "")),
            like_count=_optional_int_field(b, "like_count"),
            comments_count=_optional_int_field(b, "comments_count"),
        )

    async def fetch_media_insights(
        self, long_token: str, media_id: str, *, is_reel: bool = False
    ) -> dict[str, int | float]:
        client = await self._client()
        metrics = _REEL_INSIGHT_METRICS if is_reel else _FEED_INSIGHT_METRICS
        try:
            resp = await client.get(
                f"{settings.INSTAGRAM_GRAPH_BASE}/{media_id}/insights",
                params={"metric": metrics, "access_token": long_token},
            )
            resp.raise_for_status()
            body = resp.json()
        except httpx.HTTPError:
            raise _ig_error("Instagram insights fetch failed.") from None

        # Insights come back as [{name, values:[{value}]}]; flatten to {name: value}.
        out: dict[str, int | float] = {}
        for row in body.get("data", []):
            name = row.get("name")
            values = row.get("values") or []
            if name and values:
                out[str(name)] = _parse_insight_value(str(name), values[0].get("value", 0))
        return out


_default_client = HttpInstagramClient()


def get_instagram_client() -> InstagramClient:
    """FastAPI dependency returning the IG client (overridden in tests)."""

    return _default_client


async def close_instagram_client() -> None:
    """Close the pooled default client (called from the app lifespan)."""

    await _default_client.aclose()
