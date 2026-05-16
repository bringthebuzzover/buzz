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
