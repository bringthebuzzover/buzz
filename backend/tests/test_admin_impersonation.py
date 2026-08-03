"""Admin password login + impersonation (read-only by default)."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from app.config import settings
from app.models.enums import OrgUserStatus, PortalRole
from app.security.password import hash_password
from tests.conftest import make_brand, make_org, make_user, mint_access_token, persist


async def _admin(db_session, *, email: str | None = None, password: str | None = None):
    admin = make_user(role=PortalRole.ADMIN)
    if email is not None:
        admin.edu_email = email
    if password is not None:
        admin.password_hash = hash_password(password)
    return await persist(db_session, admin)


async def _admin_headers(db_session) -> dict:
    admin = await _admin(db_session)
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


class TestAdminLogin:
    async def test_login_succeeds(self, app_client: AsyncClient, db_session):
        await _admin(db_session, email="boss@buzz.test", password="supersecret1")

        res = await app_client.post(
            "/api/auth/admin/login",
            json={"email": "boss@buzz.test", "password": "supersecret1"},
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["access_token"]
        assert data["user"]["portal_role"] == "admin"

    async def test_login_is_case_insensitive(self, app_client: AsyncClient, db_session):
        await _admin(db_session, email="boss2@buzz.test", password="supersecret1")

        res = await app_client.post(
            "/api/auth/admin/login",
            json={"email": "BOSS2@Buzz.Test", "password": "supersecret1"},
        )
        assert res.status_code == 200

    async def test_wrong_password_rejected(self, app_client: AsyncClient, db_session):
        await _admin(db_session, email="boss3@buzz.test", password="supersecret1")

        res = await app_client.post(
            "/api/auth/admin/login",
            json={"email": "boss3@buzz.test", "password": "nope"},
        )
        assert res.status_code == 401

    async def test_unknown_email_rejected(self, app_client: AsyncClient):
        res = await app_client.post(
            "/api/auth/admin/login",
            json={"email": "ghost@buzz.test", "password": "whatever1"},
        )
        assert res.status_code == 401

    async def test_non_admin_cannot_use_admin_login(self, app_client: AsyncClient, db_session):
        """A brand password must not grant an admin session through this route."""
        brand_user = make_user(role=PortalRole.BRAND)
        brand_user.edu_email = "brand-person@buzz.test"
        brand_user.password_hash = hash_password("supersecret1")
        await persist(db_session, brand_user)

        res = await app_client.post(
            "/api/auth/admin/login",
            json={"email": "brand-person@buzz.test", "password": "supersecret1"},
        )
        assert res.status_code == 401

    async def test_suspended_admin_rejected(self, app_client: AsyncClient, db_session):
        admin = make_user(role=PortalRole.ADMIN, status=OrgUserStatus.SUSPENDED)
        admin.edu_email = "gone@buzz.test"
        admin.password_hash = hash_password("supersecret1")
        await persist(db_session, admin)

        res = await app_client.post(
            "/api/auth/admin/login",
            json={"email": "gone@buzz.test", "password": "supersecret1"},
        )
        assert res.status_code == 401


class TestAdminUserList:
    async def test_lists_org_and_brand_but_not_admins(self, app_client: AsyncClient, db_session):
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        await make_org(db_session, org_user, org_name="Listed Org")
        await make_brand(db_session, brand_name="Listed Brand")

        res = await app_client.get("/api/admin/users", headers=await _admin_headers(db_session))
        assert res.status_code == 200
        rows = res.json()["data"]

        roles = {r["portalRole"] for r in rows}
        assert "admin" not in roles
        names = {r["displayName"] for r in rows}
        assert {"Listed Org", "Listed Brand"} <= names

    async def test_requires_admin(self, app_client: AsyncClient, db_session):
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        res = await app_client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {mint_access_token(org_user)}"},
        )
        assert res.status_code == 403


class TestImpersonate:
    async def test_mints_token_acting_as_target(self, app_client: AsyncClient, db_session):
        target = await persist(db_session, make_user(role=PortalRole.ORG))
        await make_org(db_session, target)

        res = await app_client.post(
            f"/api/admin/impersonate/{target.id}",
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["user"]["id"] == str(target.id)
        assert data["user"]["portal_role"] == "org"

        # The minted token identifies as the target on /me, and reports the
        # admin behind it so the SPA can render the exit banner.
        me = await app_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {data['accessToken']}"},
        )
        assert me.status_code == 200
        body = me.json()["data"]
        assert body["id"] == str(target.id)
        assert body["impersonated_by"] is not None

    async def test_no_refresh_cookie_is_set(self, app_client: AsyncClient, db_session):
        """The admin's own refresh cookie must survive so Exit works."""
        target = await persist(db_session, make_user(role=PortalRole.ORG))

        res = await app_client.post(
            f"/api/admin/impersonate/{target.id}",
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200
        assert settings.REFRESH_COOKIE_NAME not in res.cookies

    async def test_rejects_admin_target(self, app_client: AsyncClient, db_session):
        other_admin = await _admin(db_session)

        res = await app_client.post(
            f"/api/admin/impersonate/{other_admin.id}",
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 403

    async def test_rejects_inactive_target(self, app_client: AsyncClient, db_session):
        pending = await persist(
            db_session,
            make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_APPROVAL),
        )

        res = await app_client.post(
            f"/api/admin/impersonate/{pending.id}",
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 403

    async def test_unknown_target_404s(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            f"/api/admin/impersonate/{uuid.uuid4()}",
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 404

    async def test_non_admin_cannot_impersonate(self, app_client: AsyncClient, db_session):
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        target = await persist(db_session, make_user(role=PortalRole.ORG))

        res = await app_client.post(
            f"/api/admin/impersonate/{target.id}",
            headers={"Authorization": f"Bearer {mint_access_token(org_user)}"},
        )
        assert res.status_code == 403


class TestImpersonationReadonly:
    @pytest.fixture(autouse=True)
    def _restore_readonly(self):
        prev = settings.IMPERSONATION_READONLY
        yield
        settings.IMPERSONATION_READONLY = prev

    async def _impersonation_token(self, app_client: AsyncClient, db_session) -> str:
        target = await persist(db_session, make_user(role=PortalRole.ORG))
        await make_org(db_session, target)
        res = await app_client.post(
            f"/api/admin/impersonate/{target.id}",
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200
        return res.json()["data"]["accessToken"]

    async def test_get_allowed_while_readonly(self, app_client: AsyncClient, db_session):
        settings.IMPERSONATION_READONLY = True
        token = await self._impersonation_token(app_client, db_session)

        res = await app_client.get("/api/drops", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200

    async def test_mutation_blocked_while_readonly(self, app_client: AsyncClient, db_session):
        settings.IMPERSONATION_READONLY = True
        token = await self._impersonation_token(app_client, db_session)

        res = await app_client.post(
            f"/api/drops/{uuid.uuid4()}/apply",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "IMPERSONATION_READONLY"

    async def test_mutation_allowed_when_readonly_disabled(
        self, app_client: AsyncClient, db_session
    ):
        settings.IMPERSONATION_READONLY = False
        token = await self._impersonation_token(app_client, db_session)

        res = await app_client.post(
            f"/api/drops/{uuid.uuid4()}/apply",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        # Reaches the handler (unknown drop) instead of the read-only gate.
        assert res.status_code != 403
        assert res.json().get("error", {}).get("code") != "IMPERSONATION_READONLY"

    async def test_normal_session_is_never_readonly(self, app_client: AsyncClient, db_session):
        """A plain (non-impersonated) token must never hit the read-only gate."""
        settings.IMPERSONATION_READONLY = True
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        await make_org(db_session, org_user)

        res = await app_client.post(
            f"/api/drops/{uuid.uuid4()}/apply",
            headers={"Authorization": f"Bearer {mint_access_token(org_user)}"},
            json={},
        )
        assert res.json().get("error", {}).get("code") != "IMPERSONATION_READONLY"
