"""Integration test for `GET /api/health`.

Verifies the envelope shape on a real ASGI roundtrip via `httpx.AsyncClient`
+ `ASGITransport`. This is the same path the frontend `api/client.ts` will
exercise once it ships.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health_returns_envelope() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "data": {"status": "ok", "version": "0.1.0"},
        "meta": None,
        "error": None,
    }


@pytest.mark.asyncio
async def test_unknown_route_returns_envelope() -> None:
    """A framework 404 must use the { data, meta, error } envelope, not FastAPI's
    default {"detail": ...}, so the frontend can branch on error.code."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/does-not-exist")

    assert response.status_code == 404
    body = response.json()
    assert body["data"] is None
    assert body["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_public_config_exposes_flag() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/config")

    assert response.status_code == 200
    assert "brandSelfRegistrationEnabled" in response.json()["data"]
