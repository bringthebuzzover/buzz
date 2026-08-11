"""Unit tests for the real ``HttpInstagramClient`` Stage 8 methods.

These parse live Instagram Graph responses, so they're tested against a stubbed
``httpx`` transport (no network) rather than the fake used elsewhere.
"""

from __future__ import annotations

import httpx
import pytest

from app.exceptions import BuzzAPIException
from app.services.instagram import HttpInstagramClient


def _client(handler) -> HttpInstagramClient:
    transport = httpx.MockTransport(handler)
    return HttpInstagramClient(http=httpx.AsyncClient(transport=transport))


async def test_fetch_profile_includes_followers_count() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "followers_count" in request.url.params["fields"]
        return httpx.Response(
            200,
            json={
                "id": "ig1",
                "username": "campus",
                "account_type": "BUSINESS",
                "followers_count": 4242,
            },
        )

    profile = await _client(handler).fetch_profile("tok")
    assert profile.followers_count == 4242


async def test_fetch_profile_omitted_followers_is_none() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"id": "ig1", "username": "campus", "account_type": "Media_Creator"},
        )

    profile = await _client(handler).fetch_profile("tok")
    assert profile.followers_count is None


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


async def test_fetch_media_omitted_engagement_is_none_not_zero() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id": "m1",
                "caption": "no counts",
                "media_type": "IMAGE",
                "media_product_type": "FEED",
                "permalink": "https://instagram.com/p/m1",
                "timestamp": "2030-01-01T00:00:00+0000",
            },
        )

    f = await _client(handler).fetch_media("tok", "m1")
    assert f.like_count is None
    assert f.comments_count is None


async def test_fetch_media_present_zero_engagement() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id": "m1",
                "like_count": 0,
                "comments_count": 0,
                "caption": "zeros",
                "media_type": "IMAGE",
                "media_product_type": "FEED",
                "permalink": "https://instagram.com/p/m1",
                "timestamp": "2030-01-01T00:00:00+0000",
            },
        )

    f = await _client(handler).fetch_media("tok", "m1")
    assert f.like_count == 0
    assert f.comments_count == 0


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
                    {"name": "reels_skip_rate", "values": [{"value": 0.37}]},
                    {"name": "empty", "values": []},
                ]
            },
        )

    insights = await _client(handler).fetch_media_insights("tok", "m1", is_reel=True)
    assert insights == {"reach": 500, "saved": 9, "reels_skip_rate": 0.37}
    assert "ig_reels_avg_watch_time" in captured["metric"]
    assert "reels_skip_rate" in captured["metric"]
    assert "profile_visits" not in captured["metric"]
    assert "profile_activity" not in captured["metric"]
    assert "follows" not in captured["metric"]


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
