"""Tests for the dev-only ``POST /api/auth/dev-login`` (Stage 4)."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.config import settings
from app.models.enums import OrgUserStatus, PortalRole
from tests.conftest import make_user, persist

REFRESH = settings.REFRESH_COOKIE_NAME


async def test_dev_login_default_picks_active_org(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user(status=OrgUserStatus.ACTIVE))
    resp = await app_client.post("/api/auth/dev-login", json={})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["access_token"]
    assert data["user"]["id"] == str(user.id)
    assert REFRESH in resp.headers.get("set-cookie", "")


async def test_dev_login_by_user_id(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    resp = await app_client.post("/api/auth/dev-login", json={"user_id": str(user.id)})
    assert resp.status_code == 200
    assert resp.json()["data"]["user"]["id"] == str(user.id)


async def test_dev_login_unknown_user_404(app_client: AsyncClient, db_session) -> None:
    import uuid

    resp = await app_client.post("/api/auth/dev-login", json={"user_id": str(uuid.uuid4())})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_dev_login_disabled_outside_development(
    app_client: AsyncClient, db_session, monkeypatch: pytest.MonkeyPatch
) -> None:
    await persist(db_session, make_user(role=PortalRole.ORG))
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    resp = await app_client.post("/api/auth/dev-login", json={})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"
