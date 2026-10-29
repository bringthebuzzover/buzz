"""Admin password login + impersonation (read-only by default)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.config import settings
from app.models.enums import OrgUserStatus, PortalRole
from app.security import jwt
from app.security.password import hash_password
from app.security.session import bump_token_version
from tests.conftest import make_org, make_user, mint_access_token, persist


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

    async def test_inactive_admin_rejected(self, app_client: AsyncClient, db_session):
        admin = make_user(role=PortalRole.ADMIN, status=OrgUserStatus.DENIED)
        admin.edu_email = "gone@buzz.test"
        admin.password_hash = hash_password("supersecret1")
        await persist(db_session, admin)

        res = await app_client.post(
            "/api/auth/admin/login",
            json={"email": "gone@buzz.test", "password": "supersecret1"},
        )
        assert res.status_code == 401


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


class TestImpersonationBoundToAdmin:
    async def test_admin_token_bump_kills_view_as(self, app_client: AsyncClient, db_session):
        admin = await _admin(db_session)
        target = await persist(db_session, make_user(role=PortalRole.ORG))
        await make_org(db_session, target)

        res = await app_client.post(
            f"/api/admin/impersonate/{target.id}",
            headers={"Authorization": f"Bearer {mint_access_token(admin)}"},
        )
        assert res.status_code == 200
        imp_token = res.json()["data"]["accessToken"]

        me_ok = await app_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {imp_token}"},
        )
        assert me_ok.status_code == 200

        bump_token_version(admin)
        await db_session.flush()

        me_dead = await app_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {imp_token}"},
        )
        assert me_dead.status_code == 401

    async def test_imp_bearer_logout_does_not_bump_target(
        self, app_client: AsyncClient, db_session
    ):
        admin = await _admin(db_session)
        target = await persist(db_session, make_user(role=PortalRole.ORG))
        await make_org(db_session, target)
        target_ver = target.token_version or 0

        imp_token = jwt.create_access_token(
            target.id,
            target.portal_role,
            target.status,
            token_version=target_ver,
            impersonated_by=admin.id,
            impersonator_token_version=admin.token_version or 0,
            readonly=True,
        )

        res = await app_client.post(
            "/api/auth/logout",
            headers={"Authorization": f"Bearer {imp_token}"},
        )
        assert res.status_code == 200
        await db_session.refresh(target)
        assert (target.token_version or 0) == target_ver

        me = await app_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {mint_access_token(target)}"},
        )
        assert me.status_code == 200


class TestViewAsIntentCookie:
    async def test_impersonate_sets_intent_cookie_not_refresh(
        self, app_client: AsyncClient, db_session
    ):
        target = await persist(db_session, make_user(role=PortalRole.ORG))
        res = await app_client.post(
            f"/api/admin/impersonate/{target.id}",
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200
        set_cookie = res.headers.get("set-cookie", "")
        assert settings.VIEW_AS_COOKIE_NAME in set_cookie
        assert "HttpOnly" in set_cookie
        assert settings.REFRESH_COOKIE_NAME not in set_cookie
        assert settings.VIEW_AS_COOKIE_NAME in app_client.cookies

    async def test_resume_remints_for_the_same_admin(self, app_client: AsyncClient, db_session):
        admin = await _admin(db_session)
        target = await persist(db_session, make_user(role=PortalRole.BRAND))
        headers = {"Authorization": f"Bearer {mint_access_token(admin)}"}
        minted = await app_client.post(f"/api/admin/impersonate/{target.id}", headers=headers)
        assert minted.status_code == 200

        resumed = await app_client.post(
            "/api/admin/impersonate/resume",
            headers=headers,
            json={"role": "brand"},
        )
        assert resumed.status_code == 200
        body = resumed.json()["data"]
        assert body["user"]["id"] == str(target.id)
        assert body["user"]["portal_role"] == "brand"
        assert body["user"]["impersonated_by"] == str(admin.id)
        me = await app_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {body['accessToken']}"},
        )
        assert me.status_code == 200
        assert me.json()["data"]["impersonated_by"] == str(admin.id)

    async def test_resume_without_cookie_is_404(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            "/api/admin/impersonate/resume",
            headers=await _admin_headers(db_session),
            json={"role": "org"},
        )
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "NOT_FOUND"

    async def test_resume_rejects_a_different_admin(self, app_client: AsyncClient, db_session):
        owner = await _admin(db_session)
        other = await _admin(db_session)
        target = await persist(db_session, make_user(role=PortalRole.ORG))
        minted = await app_client.post(
            f"/api/admin/impersonate/{target.id}",
            headers={"Authorization": f"Bearer {mint_access_token(owner)}"},
        )
        assert minted.status_code == 200

        resumed = await app_client.post(
            "/api/admin/impersonate/resume",
            headers={"Authorization": f"Bearer {mint_access_token(other)}"},
            json={"role": "org"},
        )
        assert resumed.status_code == 403
        cleared = resumed.headers.get("set-cookie", "")
        assert settings.VIEW_AS_COOKIE_NAME in cleared
        assert "Max-Age=0" in cleared

    async def test_intent_token_is_not_an_access_token(self, app_client: AsyncClient, db_session):
        target = await persist(db_session, make_user(role=PortalRole.ORG))
        minted = await app_client.post(
            f"/api/admin/impersonate/{target.id}",
            headers=await _admin_headers(db_session),
        )
        assert minted.status_code == 200
        intent = app_client.cookies.get(settings.VIEW_AS_COOKIE_NAME)
        assert intent
        me = await app_client.get("/api/auth/me", headers={"Authorization": f"Bearer {intent}"})
        assert me.status_code == 401

    async def test_end_clears_the_intent_cookie(self, app_client: AsyncClient, db_session):
        target = await persist(db_session, make_user(role=PortalRole.ORG))
        minted = await app_client.post(
            f"/api/admin/impersonate/{target.id}",
            headers=await _admin_headers(db_session),
        )
        assert minted.status_code == 200
        ended = await app_client.post("/api/auth/view-as/end")
        assert ended.status_code == 200
        assert "Max-Age=0" in ended.headers.get("set-cookie", "")
        resume = await app_client.post(
            "/api/admin/impersonate/resume",
            headers=await _admin_headers(db_session),
            json={"role": "org"},
        )
        assert resume.status_code == 404

    async def test_non_admin_cannot_resume(self, app_client: AsyncClient, db_session):
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        res = await app_client.post(
            "/api/admin/impersonate/resume",
            headers={"Authorization": f"Bearer {mint_access_token(org_user)}"},
            json={"role": "org"},
        )
        assert res.status_code == 403


def _set_cookie_headers(response) -> str:
    return "\n".join(response.headers.get_list("set-cookie"))


def _assert_view_as_cleared(response) -> None:
    header = _set_cookie_headers(response)
    assert settings.VIEW_AS_COOKIE_NAME in header
    assert "Max-Age=0" in header


class TestViewAsIntentSecurity:
    async def _mint(
        self, app_client: AsyncClient, db_session, *, role: PortalRole = PortalRole.ORG
    ):
        admin = await _admin(db_session)
        target = await persist(db_session, make_user(role=role))
        headers = {"Authorization": f"Bearer {mint_access_token(admin)}"}
        minted = await app_client.post(f"/api/admin/impersonate/{target.id}", headers=headers)
        assert minted.status_code == 200
        return admin, target, headers

    async def test_resume_does_not_extend_the_cookie(self, app_client: AsyncClient, db_session):
        _admin_user, _target, headers = await self._mint(
            db_session=db_session, app_client=app_client
        )
        before = jwt.decode_token(
            app_client.cookies[settings.VIEW_AS_COOKIE_NAME],
            expected_type=jwt.VIEW_AS_TOKEN_TYPE,
        )
        resumed = await app_client.post(
            "/api/admin/impersonate/resume",
            headers=headers,
            json={"role": "org"},
        )
        assert resumed.status_code == 200
        assert settings.VIEW_AS_COOKIE_NAME not in _set_cookie_headers(resumed)
        after = jwt.decode_token(
            app_client.cookies[settings.VIEW_AS_COOKIE_NAME],
            expected_type=jwt.VIEW_AS_TOKEN_TYPE,
        )
        assert after.exp == before.exp
        assert after.imp_ver == before.imp_ver

    async def test_bad_signature_clears_the_cookie(self, app_client: AsyncClient, db_session):
        _admin_user, _target, headers = await self._mint(
            db_session=db_session, app_client=app_client
        )
        token = app_client.cookies[settings.VIEW_AS_COOKIE_NAME]
        parts = token.split(".")
        parts[2] = "not-a-valid-signature"
        app_client.cookies.delete(settings.VIEW_AS_COOKIE_NAME, path="/api")
        app_client.cookies.set(settings.VIEW_AS_COOKIE_NAME, ".".join(parts), path="/api")
        resumed = await app_client.post(
            "/api/admin/impersonate/resume",
            headers=headers,
            json={"role": "org"},
        )
        assert resumed.status_code == 401
        assert resumed.json()["error"]["code"] == "VIEW_AS_INVALID"
        _assert_view_as_cleared(resumed)

    async def test_expired_cookie_clears(self, app_client: AsyncClient, db_session):
        admin, target, headers = await self._mint(db_session=db_session, app_client=app_client)
        expired = jwt.create_view_as_intent_token(
            admin.id,
            target.id,
            "org",
            impersonator_token_version=admin.token_version or 0,
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        )
        app_client.cookies.delete(settings.VIEW_AS_COOKIE_NAME, path="/api")
        app_client.cookies.set(settings.VIEW_AS_COOKIE_NAME, expired, path="/api")
        resumed = await app_client.post(
            "/api/admin/impersonate/resume",
            headers=headers,
            json={"role": "org"},
        )
        assert resumed.status_code == 401
        assert resumed.json()["error"]["code"] == "VIEW_AS_INVALID"
        _assert_view_as_cleared(resumed)

    async def test_deactivated_target_clears_the_cookie(self, app_client: AsyncClient, db_session):
        _admin_user, target, headers = await self._mint(
            db_session=db_session, app_client=app_client
        )
        target.status = OrgUserStatus.DENIED.value
        await db_session.flush()
        resumed = await app_client.post(
            "/api/admin/impersonate/resume",
            headers=headers,
            json={"role": "org"},
        )
        assert resumed.status_code == 403
        _assert_view_as_cleared(resumed)

    async def test_impersonation_token_cannot_resume(self, app_client: AsyncClient, db_session):
        _admin_user, target, headers = await self._mint(
            db_session=db_session, app_client=app_client
        )
        minted = await app_client.post(
            f"/api/admin/impersonate/{target.id}",
            headers=headers,
        )
        imp = minted.json()["data"]["accessToken"]
        resumed = await app_client.post(
            "/api/admin/impersonate/resume",
            headers={"Authorization": f"Bearer {imp}"},
            json={"role": "org"},
        )
        assert resumed.status_code == 403

    async def test_non_admin_with_a_real_cookie_cannot_resume(
        self, app_client: AsyncClient, db_session
    ):
        await self._mint(db_session=db_session, app_client=app_client)
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        resumed = await app_client.post(
            "/api/admin/impersonate/resume",
            headers={"Authorization": f"Bearer {mint_access_token(org_user)}"},
            json={"role": "org"},
        )
        assert resumed.status_code == 403
        assert "accessToken" not in resumed.text

    async def test_logout_clears_the_cookie(self, app_client: AsyncClient, db_session):
        _admin_user, _target, headers = await self._mint(
            db_session=db_session, app_client=app_client
        )
        logged_out = await app_client.post("/api/auth/logout", headers=headers)
        assert logged_out.status_code == 200
        _assert_view_as_cleared(logged_out)

    async def test_resumed_token_is_readonly(self, app_client: AsyncClient, db_session):
        _admin_user, _target, headers = await self._mint(
            db_session=db_session, app_client=app_client
        )
        resumed = await app_client.post(
            "/api/admin/impersonate/resume",
            headers=headers,
            json={"role": "org"},
        )
        assert resumed.status_code == 200
        token = resumed.json()["data"]["accessToken"]
        mutated = await app_client.post(
            f"/api/drops/{uuid.uuid4()}/apply",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        assert mutated.status_code == 403
        assert mutated.json()["error"]["code"] == "IMPERSONATION_READONLY"

    async def test_session_version_mismatch_is_rejected(self, app_client: AsyncClient, db_session):
        admin, _target, _headers = await self._mint(db_session=db_session, app_client=app_client)
        bump_token_version(admin)
        await db_session.flush()
        resumed = await app_client.post(
            "/api/admin/impersonate/resume",
            headers={"Authorization": f"Bearer {mint_access_token(admin)}"},
            json={"role": "org"},
        )
        assert resumed.status_code == 401
        assert resumed.json()["error"]["code"] == "VIEW_AS_INVALID"
        _assert_view_as_cleared(resumed)

    async def test_brand_cookie_does_not_mint_on_an_org_page(
        self, app_client: AsyncClient, db_session
    ):
        admin, _target, headers = await self._mint(
            db_session=db_session, app_client=app_client, role=PortalRole.BRAND
        )
        before = app_client.cookies[settings.VIEW_AS_COOKIE_NAME]
        resumed = await app_client.post(
            "/api/admin/impersonate/resume",
            headers=headers,
            json={"role": "org"},
        )
        assert resumed.status_code == 404
        assert settings.VIEW_AS_COOKIE_NAME not in _set_cookie_headers(resumed)
        assert app_client.cookies[settings.VIEW_AS_COOKIE_NAME] == before
        still = await app_client.post(
            "/api/admin/impersonate/resume",
            headers=headers,
            json={"role": "brand"},
        )
        assert still.status_code == 200
        assert still.json()["data"]["user"]["portal_role"] == "brand"
        assert still.json()["data"]["user"]["impersonated_by"] == str(admin.id)

    async def test_dead_refresh_clears_the_intent(self, app_client: AsyncClient, db_session):
        await self._mint(db_session=db_session, app_client=app_client)
        assert settings.VIEW_AS_COOKIE_NAME in app_client.cookies
        app_client.cookies.set(settings.REFRESH_COOKIE_NAME, "not-a-jwt", path="/api/auth")
        refreshed = await app_client.post("/api/auth/refresh")
        assert refreshed.status_code == 401
        _assert_view_as_cleared(refreshed)

    async def test_refresh_rebinds_imp_ver_without_extending_exp(
        self, app_client: AsyncClient, db_session
    ):
        await _admin(db_session, email="view-as-bind@buzz.test", password="supersecret1")
        target = await persist(db_session, make_user(role=PortalRole.ORG))
        login = await app_client.post(
            "/api/auth/admin/login",
            json={"email": "view-as-bind@buzz.test", "password": "supersecret1"},
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}
        minted = await app_client.post(f"/api/admin/impersonate/{target.id}", headers=headers)
        assert minted.status_code == 200
        before = jwt.decode_token(
            app_client.cookies[settings.VIEW_AS_COOKIE_NAME],
            expected_type=jwt.VIEW_AS_TOKEN_TYPE,
        )
        refreshed = await app_client.post("/api/auth/refresh")
        assert refreshed.status_code == 200
        after = jwt.decode_token(
            app_client.cookies[settings.VIEW_AS_COOKIE_NAME],
            expected_type=jwt.VIEW_AS_TOKEN_TYPE,
        )
        assert after.exp == before.exp
        assert after.imp_ver == (before.imp_ver or 0) + 1
        new_access = refreshed.json()["data"]["access_token"]
        resumed = await app_client.post(
            "/api/admin/impersonate/resume",
            headers={"Authorization": f"Bearer {new_access}"},
            json={"role": "org"},
        )
        assert resumed.status_code == 200

    async def test_latch_remint_cannot_outlive_the_original_window(
        self, app_client: AsyncClient, db_session
    ):
        _admin_user, target, headers = await self._mint(
            db_session=db_session, app_client=app_client
        )
        before = app_client.cookies[settings.VIEW_AS_COOKIE_NAME]
        started = datetime.now(timezone.utc) - timedelta(
            hours=settings.VIEW_AS_INTENT_TTL_HOURS, minutes=5
        )
        refused = await app_client.post(
            f"/api/admin/impersonate/{target.id}",
            headers=headers,
            json={"startedAt": int(started.timestamp() * 1000)},
        )
        assert refused.status_code == 403
        assert refused.json()["error"]["code"] == "VIEW_AS_INVALID"
        assert settings.VIEW_AS_COOKIE_NAME not in _set_cookie_headers(refused)
        assert app_client.cookies[settings.VIEW_AS_COOKIE_NAME] == before

        recent = datetime.now(timezone.utc) - timedelta(hours=2)
        continued = await app_client.post(
            f"/api/admin/impersonate/{target.id}",
            headers=headers,
            json={"startedAt": int(recent.timestamp() * 1000)},
        )
        assert continued.status_code == 200
        payload = jwt.decode_token(
            app_client.cookies[settings.VIEW_AS_COOKIE_NAME],
            expected_type=jwt.VIEW_AS_TOKEN_TYPE,
        )
        deadline = int((recent + timedelta(hours=settings.VIEW_AS_INTENT_TTL_HOURS)).timestamp())
        assert abs(payload.exp - deadline) < 5
        assert payload.exp < int((datetime.now(timezone.utc) + timedelta(hours=7)).timestamp())

    async def test_refresh_leaves_another_admins_intent_cookie(
        self, app_client: AsyncClient, db_session
    ):
        await _admin(db_session, email="view-as-owner@buzz.test", password="supersecret1")
        await _admin(db_session, email="view-as-other@buzz.test", password="supersecret1")
        target = await persist(db_session, make_user(role=PortalRole.ORG))
        owner_login = await app_client.post(
            "/api/auth/admin/login",
            json={"email": "view-as-owner@buzz.test", "password": "supersecret1"},
        )
        assert owner_login.status_code == 200
        minted = await app_client.post(
            f"/api/admin/impersonate/{target.id}",
            headers={"Authorization": f"Bearer {owner_login.json()['data']['access_token']}"},
        )
        assert minted.status_code == 200
        before_raw = app_client.cookies[settings.VIEW_AS_COOKIE_NAME]
        before = jwt.decode_token(before_raw, expected_type=jwt.VIEW_AS_TOKEN_TYPE)
        other_login = await app_client.post(
            "/api/auth/admin/login",
            json={"email": "view-as-other@buzz.test", "password": "supersecret1"},
        )
        assert other_login.status_code == 200
        refreshed = await app_client.post("/api/auth/refresh")
        assert refreshed.status_code == 200
        assert settings.VIEW_AS_COOKIE_NAME not in _set_cookie_headers(refreshed)
        assert app_client.cookies[settings.VIEW_AS_COOKIE_NAME] == before_raw
        after = jwt.decode_token(
            app_client.cookies[settings.VIEW_AS_COOKIE_NAME],
            expected_type=jwt.VIEW_AS_TOKEN_TYPE,
        )
        assert after.imp == before.imp
        assert after.imp_ver == before.imp_ver
        assert after.exp == before.exp
