"""Tests for the auth dependency gates (architecture.md §5.4).

Throwaway routes are mounted on the real app to exercise each gate; requests
go through ``app_client`` (which shares the rolled-back ``db_session``).
"""

from __future__ import annotations

from fastapi import Depends
from httpx import AsyncClient

from app.deps.auth import get_current_user, require_active_role, require_role
from app.main import app
from app.models.enums import OrgUserStatus, PortalRole
from app.models.user import User
from app.security import jwt
from tests.conftest import (
    make_user,
    mint_access_token,
    mint_expired_access_token,
    persist,
)


@app.get("/_test/current")
async def _current(user: User = Depends(get_current_user)) -> dict[str, str]:
    return {"id": str(user.id)}


@app.get("/_test/org-role")
async def _org_role(user: User = Depends(require_role(PortalRole.ORG))) -> dict[str, str]:
    return {"id": str(user.id)}


@app.get("/_test/active-org")
async def _active_org(
    user: User = Depends(require_active_role(PortalRole.ORG)),
) -> dict[str, str]:
    return {"id": str(user.id)}


async def test_valid_token_resolves_user(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    resp = await app_client.get(
        "/_test/current",
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == str(user.id)


async def test_missing_header_unauthorized(app_client: AsyncClient) -> None:
    resp = await app_client.get("/_test/current")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_malformed_header_unauthorized(app_client: AsyncClient) -> None:
    resp = await app_client.get("/_test/current", headers={"Authorization": "Token abc"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_expired_token_token_expired(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    resp = await app_client.get(
        "/_test/current",
        headers={"Authorization": f"Bearer {mint_expired_access_token(user)}"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "TOKEN_EXPIRED"


async def test_deleted_user_unauthorized(app_client: AsyncClient) -> None:
    ghost = make_user()  # never persisted
    resp = await app_client.get(
        "/_test/current",
        headers={"Authorization": f"Bearer {mint_access_token(ghost)}"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_refresh_token_rejected_as_bearer(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    refresh = jwt.create_refresh_token(user.id)
    resp = await app_client.get("/_test/current", headers={"Authorization": f"Bearer {refresh}"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_wrong_role_forbidden(app_client: AsyncClient, db_session) -> None:
    brand = await persist(db_session, make_user(role=PortalRole.BRAND))
    resp = await app_client.get(
        "/_test/org-role",
        headers={"Authorization": f"Bearer {mint_access_token(brand)}"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_non_active_status_forbidden(app_client: AsyncClient, db_session) -> None:
    pending = await persist(
        db_session,
        make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_ORG_PROFILE),
    )
    resp = await app_client.get(
        "/_test/active-org",
        headers={"Authorization": f"Bearer {mint_access_token(pending)}"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"
