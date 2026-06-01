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
from typing import Protocol, runtime_checkable
from urllib.parse import urlencode

import httpx

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException

# Instagram account types that may grant the business scopes Buzz needs.
ALLOWED_ACCOUNT_TYPES = frozenset({"BUSINESS", "CREATOR"})


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
    """``/me`` profile used to gate Personal accounts (§3.4)."""

    id: str
    username: str
    account_type: str


@runtime_checkable
class InstagramClient(Protocol):
    """The four IG operations Stage 3 needs. Implemented by HTTP + fakes."""

    def build_authorize_url(self, state: str) -> str: ...

    async def exchange_code(self, code: str) -> ShortLivedToken: ...

    async def exchange_for_long_lived(self, short_token: str) -> LongLivedToken: ...

    async def fetch_profile(self, long_token: str) -> InstagramProfile: ...


def _ig_error(message: str) -> BuzzAPIException:
    # Generic 401 — never echo request params (they carry ``client_secret``).
    return BuzzAPIException(code=errors.UNAUTHORIZED, message=message, status_code=401)


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
        except httpx.HTTPError as exc:
            raise _ig_error("Instagram code exchange failed.") from exc

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
        except httpx.HTTPError as exc:
            raise _ig_error("Instagram long-lived token exchange failed.") from exc

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
                params={"fields": "id,username,account_type", "access_token": long_token},
            )
            resp.raise_for_status()
            body = resp.json()
        except httpx.HTTPError as exc:
            raise _ig_error("Instagram profile lookup failed.") from exc

        if not body.get("id") or not body.get("account_type"):
            raise _ig_error("Instagram profile lookup returned no account.")
        return InstagramProfile(
            id=str(body["id"]),
            username=str(body.get("username", "")),
            account_type=str(body["account_type"]),
        )


_default_client = HttpInstagramClient()


def get_instagram_client() -> InstagramClient:
    """FastAPI dependency returning the IG client (overridden in tests)."""

    return _default_client


async def close_instagram_client() -> None:
    """Close the pooled default client (called from the app lifespan)."""

    await _default_client.aclose()
