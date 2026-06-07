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


async def test_fetch_media_insights_flattens_values() -> None:
    captured: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["metric"] = request.url.params["metric"]
        return httpx.Response(
            200,
            json={
                "data": [
                    {"name": "reach", "values": [{"value": 500}]},
                    {"name": "saved", "values": [{"value": 9}]},
                    {"name": "empty", "values": []},
                ]
            },
        )

    insights = await _client(handler).fetch_media_insights("tok", "m1", is_reel=True)
    assert insights == {"reach": 500, "saved": 9}
    # reel-only metrics requested when is_reel=True
    assert "ig_reels_avg_watch_time" in captured["metric"]
