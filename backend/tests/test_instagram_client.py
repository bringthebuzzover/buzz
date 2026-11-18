"""Unit tests for the real ``HttpInstagramClient`` Stage 8 methods.

These parse live Instagram Graph responses, so they're tested against a stubbed
``httpx`` transport (no network) rather than the fake used elsewhere.
"""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from app.config import Settings, settings
from app.exceptions import BuzzAPIException
from app.services.instagram import (
    HttpInstagramClient,
    instagram_graph_url,
    merge_follower_count,
    storable_follower_count,
)


def test_build_authorize_url_stays_in_browser() -> None:
    url = HttpInstagramClient().build_authorize_url("oauth-state")
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    assert url.startswith(f"{settings.INSTAGRAM_AUTHORIZE_URL}?")
    assert parsed.fragment == "weblink"
    assert query["response_type"] == ["code"]
    assert query["state"] == ["oauth-state"]
    assert query["scope"] == [settings.INSTAGRAM_SCOPES]


def _client(handler) -> HttpInstagramClient:
    transport = httpx.MockTransport(handler)
    return HttpInstagramClient(http=httpx.AsyncClient(transport=transport))


async def test_exchange_code_parses_documented_data_array() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "access_token": "IGQVJ-short",
                        "user_id": "1020",
                        "permissions": "instagram_business_basic",
                    }
                ]
            },
        )

    out = await _client(handler).exchange_code("the-code")
    assert out.access_token == "IGQVJ-short"
    assert out.user_id == "1020"
    assert out.permissions == ("instagram_business_basic",)


async def test_exchange_code_parses_legacy_flat_payload() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"access_token": "flat-short", "user_id": 7788},
        )

    out = await _client(handler).exchange_code("c")
    assert out.access_token == "flat-short"
    assert out.user_id == "7788"
    assert out.permissions is None


@pytest.mark.parametrize(
    ("method", "arg", "body", "meta_message"),
    [
        (
            "exchange_code",
            "c",
            {
                "error_type": "OAuthException",
                "code": 400,
                "error_message": "Matching code was not found or was already used",
            },
            "Matching code was not found",
        ),
        (
            "exchange_for_long_lived",
            "IGQVJ-secret-short",
            {
                "error": {
                    "message": "Unsupported request - method type: get",
                    "type": "IGApiException",
                    "code": 100,
                }
            },
            "Unsupported request - method type: get",
        ),
    ],
)
async def test_token_exchange_http_error_logs_meta_not_secrets(
    caplog: pytest.LogCaptureFixture, method: str, arg: str, body: dict, meta_message: str
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json=body)

    with caplog.at_level("WARNING", logger="app.services.instagram"):
        with pytest.raises(BuzzAPIException) as exc:
            await getattr(_client(handler), method)(arg)
    assert exc.value.status_code == 401
    assert "client_secret" not in exc.value.message
    assert meta_message in caplog.text
    assert "IGQVJ" not in caplog.text


def test_default_graph_version_matches_instagram_login_docs() -> None:
    assert Settings.model_fields["INSTAGRAM_GRAPH_VERSION"].default == "v26.0"


def test_instagram_graph_url_joins_host_and_version(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "INSTAGRAM_GRAPH_BASE", "https://graph.instagram.com/")
    monkeypatch.setattr(settings, "INSTAGRAM_GRAPH_VERSION", "v26.0")
    assert instagram_graph_url("me") == "https://graph.instagram.com/v26.0/me"
    assert instagram_graph_url("/me/media") == "https://graph.instagram.com/v26.0/me/media"
    assert (
        instagram_graph_url("media-1/insights")
        == "https://graph.instagram.com/v26.0/media-1/insights"
    )
    monkeypatch.setattr(settings, "INSTAGRAM_GRAPH_VERSION", "  ")
    assert instagram_graph_url("me") == "https://graph.instagram.com/me"


async def test_read_calls_are_versioned_and_me_still_requests_user_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Sync and login share ``fetch_profile``; ``user_id`` stays on that /me call."""

    monkeypatch.setattr(settings, "INSTAGRAM_GRAPH_BASE", "https://graph.instagram.com")
    monkeypatch.setattr(settings, "INSTAGRAM_GRAPH_VERSION", "v26.0")
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.path)
        if request.url.path.endswith("/access_token"):
            return httpx.Response(
                200, json={"access_token": "long-tok", "token_type": "bearer", "expires_in": 60}
            )
        if request.url.path.endswith("/refresh_access_token"):
            return httpx.Response(200, json={"access_token": "refreshed", "expires_in": 60})
        if request.url.path.endswith("/me"):
            assert request.url.params["fields"] == (
                "id,user_id,username,account_type,followers_count"
            )
            return httpx.Response(
                200,
                json={
                    "id": "ig",
                    "user_id": "ig-pro",
                    "username": "campus",
                    "account_type": "BUSINESS",
                },
            )
        if request.url.path.endswith("/me/media"):
            return httpx.Response(200, json={"data": []})
        if request.url.path.endswith("/insights"):
            return httpx.Response(200, json={"data": []})
        return httpx.Response(
            200,
            json={
                "id": "m1",
                "media_type": "IMAGE",
                "media_product_type": "FEED",
                "permalink": "https://instagram.com/p/m1",
                "timestamp": "2030-01-01T00:00:00+0000",
            },
        )

    client = _client(handler)
    await client.exchange_for_long_lived("short")
    await client.refresh_long_lived("long")
    profile = await client.fetch_profile("tok")
    await client.fetch_user_media("tok")
    await client.fetch_media("tok", "m1")
    await client.fetch_media_insights("tok", "m1")
    assert profile.id == "ig"
    assert seen == [
        "/access_token",
        "/refresh_access_token",
        "/v26.0/me",
        "/v26.0/me/media",
        "/v26.0/m1",
        "/v26.0/m1/insights",
    ]


async def test_exchange_code_logs_permissions_and_warns_on_extras(
    caplog: pytest.LogCaptureFixture,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "access_token": "IGQVJ-do-not-log",
                "user_id": "55",
                "permissions": [
                    "instagram_business_basic",
                    " instagram_business_manage_insights ",
                    "instagram_business_manage_messages",
                    "instagram_business_basic",
                ],
            },
        )

    with caplog.at_level("INFO", logger="app.services.instagram"):
        out = await _client(handler).exchange_code("c")
    assert out.permissions == (
        "instagram_business_basic",
        "instagram_business_manage_insights",
        "instagram_business_manage_messages",
    )
    assert (
        "granted_permissions=instagram_business_basic,"
        "instagram_business_manage_insights,instagram_business_manage_messages"
    ) in caplog.text
    assert "unexpected_permissions=instagram_business_manage_messages" in caplog.text
    assert "IGQVJ-do-not-log" not in caplog.text


async def test_exchange_code_unrecognized_permissions_shape(
    caplog: pytest.LogCaptureFixture,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"access_token": "tok", "user_id": "9", "permissions": {"scope": "basic"}},
        )

    with caplog.at_level("WARNING", logger="app.services.instagram"):
        out = await _client(handler).exchange_code("c")
    assert out.permissions is None
    assert "granted_permissions unrecognized type=dict" in caplog.text
    assert "tok" not in caplog.text


async def test_exchange_for_long_lived_gets_query() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path.endswith("/access_token")
        assert request.url.params["grant_type"] == "ig_exchange_token"
        assert request.url.params["access_token"] == "IGQVJ-short"
        assert request.url.params["client_secret"] == settings.INSTAGRAM_CLIENT_SECRET
        return httpx.Response(
            200,
            json={"access_token": "IGQVJ-long", "token_type": "bearer", "expires_in": 5184000},
        )

    out = await _client(handler).exchange_for_long_lived("IGQVJ-short")
    assert out.access_token == "IGQVJ-long"
    assert out.expires_in == 5184000


async def test_exchange_for_long_lived_parses_data_array() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        return httpx.Response(
            200,
            json={
                "data": [{"access_token": "wrapped-long", "token_type": "bearer", "expires_in": 60}]
            },
        )

    out = await _client(handler).exchange_for_long_lived("short")
    assert out.access_token == "wrapped-long"
    assert out.expires_in == 60


async def test_fetch_profile_parses_data_array_user_id() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "user_id" in request.url.params["fields"]
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "user_id": "ig1",
                        "username": "campus",
                        "account_type": "BUSINESS",
                        "followers_count": 9,
                    }
                ]
            },
        )

    profile = await _client(handler).fetch_profile("tok")
    assert profile.id == "ig1"
    assert profile.username == "campus"
    assert profile.followers_count == 9


async def test_fetch_profile_prefers_id_over_user_id() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id": "app-scoped",
                "user_id": "ig-pro",
                "username": "campus",
                "account_type": "MEDIA_CREATOR",
            },
        )

    profile = await _client(handler).fetch_profile("tok")
    assert profile.id == "app-scoped"


@pytest.mark.parametrize(
    ("graph", "expected"),
    [({"followers_count": 4242}, 4242), ({}, None), ({"followers_count": None}, None)],
)
async def test_fetch_profile_followers_count(graph: dict, expected: int | None) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "followers_count" in request.url.params["fields"]
        return httpx.Response(
            200,
            json={"id": "ig1", "username": "campus", "account_type": "BUSINESS", **graph},
        )

    profile = await _client(handler).fetch_profile("tok")
    assert profile.followers_count == expected
    assert profile.followers_count_invalid is False


@pytest.mark.parametrize(
    ("current", "incoming", "expected"),
    [(77, None, 77), (None, None, None), (50, 0, 0), (10, 8800, 8800), (None, 5, 5)],
)
def test_merge_follower_count(
    current: int | None, incoming: int | None, expected: int | None
) -> None:
    """The one merge rule: an omitted count keeps the stored one; a real 0 overwrites."""
    assert merge_follower_count(current, incoming) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, None),
        (0, 0),
        (5150, 5150),
        (-1, -1),
        (True, None),
        (False, None),
        (1.0, 1),
        (1.5, None),
        (float("nan"), None),
        (float("inf"), None),
        (2_147_483_647, 2_147_483_647),
        (2_147_483_648, None),
        (-2_147_483_649, None),
        ("4242", 4242),
        ("0", 0),
        ("4242.0", 4242),
        ("false", None),
        ("nope", None),
        ("", None),
        ({"n": 1}, None),
    ],
)
def test_storable_follower_count(raw: object, expected: int | None) -> None:
    assert storable_follower_count(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [False, True, "nope", 1.5, 3_000_000_000, "IGQVJ-not-a-count"],
)
async def test_fetch_profile_bad_followers_does_not_raise(raw: object, caplog) -> None:
    """An unusable followers_count must not fail profile parse or land in logs."""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["access_token"] == "IGQVJ-secret-profile-token"
        return httpx.Response(
            200,
            json={
                "id": "ig1",
                "username": "campus",
                "account_type": "BUSINESS",
                "followers_count": raw,
            },
        )

    with caplog.at_level("WARNING"):
        profile = await _client(handler).fetch_profile("IGQVJ-secret-profile-token")
    assert profile.followers_count is None
    assert profile.followers_count_invalid is True
    assert "reason=invalid" in caplog.text
    assert f"type={type(raw).__name__}" in caplog.text
    assert "IGQVJ-secret-profile-token" not in caplog.text
    assert "IGQVJ-not-a-count" not in caplog.text


async def test_refresh_long_lived_parses_token() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/refresh_access_token")
        assert request.url.params["grant_type"] == "ig_refresh_token"
        return httpx.Response(200, json={"access_token": "new-tok", "expires_in": 5183944})

    out = await _client(handler).refresh_long_lived("old-tok")
    assert out.access_token == "new-tok"
    assert out.expires_in == 5183944


async def test_refresh_long_lived_http_error_raises_typed() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": {"message": "bad"}})

    with pytest.raises(BuzzAPIException) as exc:
        await _client(handler).refresh_long_lived("old-tok")
    assert exc.value.status_code == 401


async def test_fetch_user_media_maps_rows() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/me/media")
        return httpx.Response(
            200,
            json={
                "data": [
                    {"id": "m1", "timestamp": "2030-01-01T00:00:00+0000"},
                    {"id": "m2", "timestamp": "2030-01-02T00:00:00+0000"},
                    {"timestamp": "no-id-skipped"},
                ]
            },
        )

    media = await _client(handler).fetch_user_media("tok")
    assert [m.id for m in media] == ["m1", "m2"]


async def test_fetch_media_parses_fields() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id": "m1",
                "like_count": 42,
                "comments_count": 7,
                "caption": "hello @nike",
                "media_type": "VIDEO",
                "media_product_type": "REELS",
                "permalink": "https://instagram.com/p/m1",
                "thumbnail_url": "https://t/x.jpg",
                "timestamp": "2030-01-01T00:00:00+0000",
            },
        )

    f = await _client(handler).fetch_media("tok", "m1")
    assert f.like_count == 42 and f.comments_count == 7
    assert f.media_product_type == "REELS"
    assert f.caption == "hello @nike"
    assert f.thumbnail_url == "https://t/x.jpg"
    assert f.thumbnail_url_omitted is False
    assert f.media_url is None
    assert f.media_url_omitted is True


@pytest.mark.parametrize(
    ("graph", "expected"),
    [
        # An omitted field parses to None ("unknown"), never to 0 / "".
        ({"caption": "no counts"}, {"like_count": None, "comments_count": None}),
        ({"like_count": 1, "comments_count": 0}, {"caption": None}),
        # A present 0 / "" is a real value.
        (
            {"like_count": 0, "comments_count": 0, "caption": "zeros"},
            {"like_count": 0, "comments_count": 0},
        ),
        ({"like_count": 1, "comments_count": 0, "caption": ""}, {"caption": ""}),
    ],
)
async def test_fetch_media_omitted_vs_present_fields(graph: dict, expected: dict) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id": "m1",
                "media_type": "IMAGE",
                "media_product_type": "FEED",
                "permalink": "https://instagram.com/p/m1",
                "timestamp": "2030-01-01T00:00:00+0000",
                **graph,
            },
        )

    f = await _client(handler).fetch_media("tok", "m1")
    assert {key: getattr(f, key) for key in expected} == expected
    assert f.media_url_omitted is True
    assert f.thumbnail_url_omitted is True


async def test_fetch_media_url_omit_vs_present_null() -> None:
    def omitted(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id": "m1",
                "caption": "x",
                "media_type": "IMAGE",
                "media_product_type": "FEED",
                "permalink": "https://instagram.com/p/m1",
                "timestamp": "2030-01-01T00:00:00+0000",
            },
        )

    omitted_fields = await _client(omitted).fetch_media("tok", "m1")
    assert omitted_fields.media_url is None
    assert omitted_fields.thumbnail_url is None
    assert omitted_fields.media_url_omitted is True
    assert omitted_fields.thumbnail_url_omitted is True

    def present_null(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id": "m1",
                "caption": "x",
                "media_type": "IMAGE",
                "media_product_type": "FEED",
                "permalink": "https://instagram.com/p/m1",
                "media_url": None,
                "thumbnail_url": None,
                "timestamp": "2030-01-01T00:00:00+0000",
            },
        )

    cleared = await _client(present_null).fetch_media("tok", "m1")
    assert cleared.media_url is None
    assert cleared.thumbnail_url is None
    assert cleared.media_url_omitted is False
    assert cleared.thumbnail_url_omitted is False


async def test_fetch_media_insights_feed_includes_profile_metrics() -> None:
    captured: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["metric"] = request.url.params["metric"]
        return httpx.Response(
            200,
            json={"data": [{"name": "reach", "values": [{"value": 10}]}]},
        )

    await _client(handler).fetch_media_insights("tok", "m1", is_reel=False)
    assert "profile_visits" in captured["metric"]
    assert "follows" in captured["metric"]
    assert "ig_reels_avg_watch_time" not in captured["metric"]


async def test_fetch_media_insights_reels_excludes_feed_only_metrics() -> None:
    captured: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["metric"] = request.url.params["metric"]
        return httpx.Response(
            200,
            json={
                "data": [
                    {"name": "reach", "values": [{"value": 500}]},
                    {"name": "saved", "values": [{"value": 9}]},
                    {"name": "reels_skip_rate", "values": [{"value": 62.8}]},
                    {"name": "empty", "values": []},
                ]
            },
        )

    insights = await _client(handler).fetch_media_insights("tok", "m1", is_reel=True)
    assert insights == {"reach": 500, "saved": 9, "reels_skip_rate": 62.8}
    assert "ig_reels_avg_watch_time" in captured["metric"]
    assert "reels_skip_rate" in captured["metric"]
    assert "profile_visits" not in captured["metric"]
    assert "profile_activity" not in captured["metric"]
    assert "follows" not in captured["metric"]


@pytest.mark.parametrize("is_reel", [False, True])
async def test_fetch_media_insights_never_requests_reposts(is_reel: bool) -> None:
    captured: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["metric"] = request.url.params["metric"]
        return httpx.Response(200, json={"data": []})

    await _client(handler).fetch_media_insights("tok", "m1", is_reel=is_reel)
    assert "reposts" not in captured["metric"].split(",")


async def test_fetch_media_insights_logs_graph_error(caplog: pytest.LogCaptureFixture) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            400,
            json={"error": {"message": "does not support the metrics: x", "code": 100}},
        )

    with caplog.at_level("WARNING"), pytest.raises(BuzzAPIException):
        await _client(handler).fetch_media_insights("secret-tok", "m1")
    assert "media insights failed status=400" in caplog.text
    assert "does not support the metrics" in caplog.text
    assert "secret-tok" not in caplog.text


async def test_fetch_user_media_follows_paging_next() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(
                200,
                json={
                    "data": [{"id": "m1", "timestamp": "2030-01-02T00:00:00+00:00"}],
                    "paging": {"next": "https://graph.instagram.com/v1/me/media?after=cursor"},
                },
            )
        return httpx.Response(
            200,
            json={
                "data": [{"id": "m2", "timestamp": "2030-01-01T00:00:00+00:00"}],
            },
        )

    media = await _client(handler).fetch_user_media("tok")
    assert [m.id for m in media] == ["m1", "m2"]
    assert calls["n"] == 2


async def test_fetch_user_media_stops_when_page_outside_window() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(
                200,
                json={
                    "data": [{"id": "old", "timestamp": "2000-01-01T00:00:00+00:00"}],
                    "paging": {"next": "https://graph.instagram.com/v1/me/media?after=x"},
                },
            )
        return httpx.Response(
            200,
            json={"data": [{"id": "should-not-fetch", "timestamp": "1999-01-01T00:00:00+00:00"}]},
        )

    media = await _client(handler).fetch_user_media("tok")
    assert [m.id for m in media] == ["old"]
    assert calls["n"] == 1
