"""Brand settings: name patch, password change, and admin-approved IG handle."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app import errors
from app.config import settings
from app.models.brand_ig_change_request import BrandIgChangeRequest
from app.models.enums import PortalRole
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.security import jwt, rate_limit
from app.security.one_shot_tokens import hash_token
from app.security.password import hash_password, verify_password
from tests.conftest import make_brand, make_user, mint_access_token, persist


def _headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {mint_access_token(user)}"}


async def _brand(
    db_session,
    *,
    password: str = "current-pass-1",
    handle: str | None = "acmecoffee",
    email: str = "brand-settings@example.test",
    name: str = "Acme Coffee",
):
    brand = await make_brand(db_session, brand_name=name, company_email=email)
    brand.instagram_handle = handle
    user = await db_session.get(User, brand.user_id)
    assert user is not None
    user.password_hash = hash_password(password)
    user.token_version = 0
    await db_session.flush()
    return user, brand


async def _admin_headers(db_session) -> dict[str, str]:
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return _headers(admin)


@pytest.fixture
def _enable_rate_limit():
    prev = settings.RATE_LIMIT_ENABLED
    settings.RATE_LIMIT_ENABLED = True
    rate_limit.reset()
    yield
    settings.RATE_LIMIT_ENABLED = prev
    rate_limit.reset()


class TestPatchBrandProfile:
    async def test_renames_and_leaves_handle(self, app_client: AsyncClient, db_session):
        user, brand = await _brand(db_session)
        res = await app_client.patch(
            "/api/brands/me",
            json={"brandName": "  Acme Roasters  "},
            headers=_headers(user),
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["brandName"] == "Acme Roasters"
        assert data["instagramHandle"] == "acmecoffee"
        assert data["companyEmail"] == "brand-settings@example.test"
        await db_session.refresh(brand)
        assert brand.brand_name == "Acme Roasters"
        assert brand.instagram_handle == "acmecoffee"

    async def test_empty_body_is_a_noop(self, app_client: AsyncClient, db_session):
        user, brand = await _brand(db_session)
        res = await app_client.patch("/api/brands/me", json={}, headers=_headers(user))
        assert res.status_code == 200, res.text
        assert res.json()["data"]["brandName"] == "Acme Coffee"
        await db_session.refresh(brand)
        assert brand.brand_name == "Acme Coffee"

    async def test_rejects_handle_and_email(self, app_client: AsyncClient, db_session):
        user, brand = await _brand(db_session)
        for body in (
            {"instagramHandle": "other"},
            {"email": "other@example.test"},
            {"brandName": "Ok", "instagramHandle": "other"},
        ):
            res = await app_client.patch("/api/brands/me", json=body, headers=_headers(user))
            assert res.status_code == 422, body
            assert res.json()["error"]["code"] == errors.VALIDATION_ERROR
        await db_session.refresh(brand)
        assert brand.instagram_handle == "acmecoffee"
        assert brand.company_email == "brand-settings@example.test"

    @pytest.mark.parametrize(
        "body",
        [
            {"brandName": None},
            {"brandName": "   "},
            {"brandName": ""},
            {"brandName": "x" * 121},
        ],
    )
    async def test_rejects_bad_name(self, app_client: AsyncClient, db_session, body):
        user, _brand_row = await _brand(db_session)
        res = await app_client.patch("/api/brands/me", json=body, headers=_headers(user))
        assert res.status_code == 422, res.text
        assert res.json()["error"]["code"] == errors.VALIDATION_ERROR

    async def test_auth(self, app_client: AsyncClient, db_session):
        res = await app_client.patch("/api/brands/me", json={"brandName": "Nope"})
        assert res.status_code == 401
        org = await persist(db_session, make_user(role=PortalRole.ORG))
        res = await app_client.patch(
            "/api/brands/me",
            json={"brandName": "Nope"},
            headers=_headers(org),
        )
        assert res.status_code == 403

    async def test_rate_limited(self, app_client: AsyncClient, db_session, _enable_rate_limit):
        user, _brand_row = await _brand(db_session)
        statuses = []
        for _ in range(11):
            res = await app_client.patch(
                "/api/brands/me",
                json={"brandName": "Acme Coffee"},
                headers=_headers(user),
            )
            statuses.append(res.status_code)
        assert statuses[:10] == [200] * 10
        assert statuses[10] == 429
        assert res.json()["error"]["code"] == errors.RATE_LIMITED


class TestChangeBrandPassword:
    async def test_success_revokes_other_sessions_and_emails(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        user, brand = await _brand(db_session)
        raw = "reset-token-raw"
        reset = PasswordResetToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=hash_token(raw),
            email=brand.company_email,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        db_session.add(reset)
        await db_session.flush()
        old_headers = _headers(user)
        sent = AsyncMock(return_value=True)
        monkeypatch.setattr("app.routes.auth.send_brand_password_changed_email", sent)

        res = await app_client.post(
            "/api/auth/brand/change-password",
            json={"currentPassword": "current-pass-1", "newPassword": "next-pass-22"},
            headers=old_headers,
        )
        assert res.status_code == 200, res.text
        body = res.json()["data"]
        assert body["access_token"]
        assert body["user"]["portal_role"] == "brand"
        assert body["user"]["email"] == brand.company_email
        assert "buzz_refresh" in (res.headers.get("set-cookie") or "")
        sent.assert_awaited_once()
        assert sent.await_args.args[0] == brand.company_email

        await db_session.refresh(user)
        assert user.token_version == 1
        assert verify_password("next-pass-22", user.password_hash or "")
        await db_session.refresh(reset)
        assert reset.used_at is not None

        old = await app_client.get("/api/auth/me", headers=old_headers)
        assert old.status_code == 401
        fresh = await app_client.get(
            "/api/brands/me",
            headers={"Authorization": f"Bearer {body['access_token']}"},
        )
        assert fresh.status_code == 200

        reused = await app_client.post(
            "/api/auth/brand/reset-password",
            json={"token": raw, "password": "another-pass-1"},
        )
        assert reused.status_code == 400
        assert reused.json()["error"]["code"] == errors.PASSWORD_RESET_TOKEN_USED

    async def test_wrong_current_password(self, app_client: AsyncClient, db_session):
        user, _brand_row = await _brand(db_session)
        res = await app_client.post(
            "/api/auth/brand/change-password",
            json={"currentPassword": "not-the-password", "newPassword": "next-pass-22"},
            headers=_headers(user),
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == errors.WRONG_PASSWORD
        await db_session.refresh(user)
        assert verify_password("current-pass-1", user.password_hash or "")
        assert (user.token_version or 0) == 0

    async def test_new_password_must_differ(self, app_client: AsyncClient, db_session):
        user, _brand_row = await _brand(db_session)
        res = await app_client.post(
            "/api/auth/brand/change-password",
            json={"currentPassword": "current-pass-1", "newPassword": "current-pass-1"},
            headers=_headers(user),
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == errors.VALIDATION_ERROR

    async def test_new_password_min_length(self, app_client: AsyncClient, db_session):
        user, _brand_row = await _brand(db_session)
        res = await app_client.post(
            "/api/auth/brand/change-password",
            json={"currentPassword": "current-pass-1", "newPassword": "short"},
            headers=_headers(user),
        )
        assert res.status_code == 422
        assert res.json()["error"]["code"] == errors.VALIDATION_ERROR

    async def test_rejects_extra_fields(self, app_client: AsyncClient, db_session):
        user, _brand_row = await _brand(db_session)
        res = await app_client.post(
            "/api/auth/brand/change-password",
            json={
                "currentPassword": "current-pass-1",
                "newPassword": "next-pass-22",
                "email": "other@example.test",
            },
            headers=_headers(user),
        )
        assert res.status_code == 422

    async def test_auth(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            "/api/auth/brand/change-password",
            json={"currentPassword": "current-pass-1", "newPassword": "next-pass-22"},
        )
        assert res.status_code == 401
        org = await persist(db_session, make_user(role=PortalRole.ORG))
        res = await app_client.post(
            "/api/auth/brand/change-password",
            json={"currentPassword": "current-pass-1", "newPassword": "next-pass-22"},
            headers=_headers(org),
        )
        assert res.status_code == 403

    async def test_view_as_readonly_refused(self, app_client: AsyncClient, db_session):
        user, _brand_row = await _brand(db_session)
        admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
        token = jwt.create_access_token(
            user.id,
            user.portal_role,
            user.status,
            token_version=user.token_version or 0,
            impersonated_by=admin.id,
            impersonator_token_version=admin.token_version or 0,
            readonly=True,
        )
        res = await app_client.post(
            "/api/auth/brand/change-password",
            json={"currentPassword": "current-pass-1", "newPassword": "next-pass-22"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == errors.IMPERSONATION_READONLY
        await db_session.refresh(user)
        assert verify_password("current-pass-1", user.password_hash or "")

    async def test_view_as_writable_still_refused(self, app_client: AsyncClient, db_session):
        user, _brand_row = await _brand(db_session)
        admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
        token = jwt.create_access_token(
            user.id,
            user.portal_role,
            user.status,
            token_version=user.token_version or 0,
            impersonated_by=admin.id,
            impersonator_token_version=admin.token_version or 0,
            readonly=False,
        )
        res = await app_client.post(
            "/api/auth/brand/change-password",
            json={"currentPassword": "current-pass-1", "newPassword": "next-pass-22"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == errors.FORBIDDEN
        await db_session.refresh(user)
        assert verify_password("current-pass-1", user.password_hash or "")
        assert (user.token_version or 0) == 0

    async def test_rate_limited(self, app_client: AsyncClient, db_session, _enable_rate_limit):
        user, _brand_row = await _brand(db_session)
        statuses = []
        for _ in range(6):
            res = await app_client.post(
                "/api/auth/brand/change-password",
                json={"currentPassword": "wrong-pass-xx", "newPassword": "next-pass-22"},
                headers=_headers(user),
            )
            statuses.append(res.status_code)
        assert statuses[:5] == [400] * 5
        assert statuses[5] == 429
        assert res.json()["error"]["code"] == errors.RATE_LIMITED


class TestBrandIgChange:
    async def test_submit_normalizes_and_blocks_a_second_pending(
        self, app_client: AsyncClient, db_session
    ):
        user, brand = await _brand(db_session)
        res = await app_client.post(
            "/api/brands/me/ig-change-requests",
            json={"requestedHandle": "@New.Handle", "reason": "  Rebrand after the merger.  "},
            headers=_headers(user),
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["requestedHandle"] == "new.handle"
        assert data["currentHandle"] == "acmecoffee"
        assert data["status"] == "pending"
        assert data["reason"] == "Rebrand after the merger."

        state = await app_client.get("/api/brands/me/ig-change-request", headers=_headers(user))
        assert state.status_code == 200
        body = state.json()["data"]
        assert body["pending"]["id"] == data["id"]
        assert body["latest"]["id"] == data["id"]

        again = await app_client.post(
            "/api/brands/me/ig-change-requests",
            json={"requestedHandle": "anotherhandle", "reason": "A second request should fail."},
            headers=_headers(user),
        )
        assert again.status_code == 409
        assert again.json()["error"]["code"] == errors.INVALID_ONBOARDING_STATE
        await db_session.refresh(brand)
        assert brand.instagram_handle == "acmecoffee"

    async def test_empty_state(self, app_client: AsyncClient, db_session):
        user, _brand_row = await _brand(db_session)
        res = await app_client.get("/api/brands/me/ig-change-request", headers=_headers(user))
        assert res.status_code == 200
        assert res.json()["data"] == {"pending": None, "latest": None}

    @pytest.mark.parametrize(
        "body",
        [
            {"requestedHandle": "not a handle", "reason": "Long enough reason here."},
            {"requestedHandle": "@acmecoffee", "reason": "Long enough reason here."},
            {"requestedHandle": "newhandle", "reason": "short"},
            {"requestedHandle": "", "reason": "Long enough reason here."},
        ],
    )
    async def test_validation(self, app_client: AsyncClient, db_session, body):
        user, _brand_row = await _brand(db_session)
        res = await app_client.post(
            "/api/brands/me/ig-change-requests",
            json=body,
            headers=_headers(user),
        )
        assert res.status_code == 400, res.text
        assert res.json()["error"]["code"] == errors.VALIDATION_ERROR

    async def test_auth(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            "/api/brands/me/ig-change-requests",
            json={"requestedHandle": "newhandle", "reason": "Long enough reason here."},
        )
        assert res.status_code == 401
        org = await persist(db_session, make_user(role=PortalRole.ORG))
        res = await app_client.get("/api/brands/me/ig-change-request", headers=_headers(org))
        assert res.status_code == 403

    async def test_approve_sets_handle_deny_does_not(self, app_client: AsyncClient, db_session):
        user, brand = await _brand(db_session, email="approve-me@example.test")
        other_user, other = await _brand(
            db_session, email="deny-me@example.test", handle="otherbrand", name="Other"
        )
        admin = await _admin_headers(db_session)
        created = await app_client.post(
            "/api/brands/me/ig-change-requests",
            json={"requestedHandle": "acme.new", "reason": "We are rebranding the shop."},
            headers=_headers(user),
        )
        assert created.status_code == 200, created.text
        request_id = created.json()["data"]["id"]
        denied = await app_client.post(
            "/api/brands/me/ig-change-requests",
            json={"requestedHandle": "other.new", "reason": "Please do not approve this one."},
            headers=_headers(other_user),
        )
        assert denied.status_code == 200, denied.text
        deny_id = denied.json()["data"]["id"]

        listed = await app_client.get(
            "/api/admin/brand-ig-change-requests?status=pending", headers=admin
        )
        assert listed.status_code == 200
        ids = {row["id"] for row in listed.json()["data"]}
        assert ids == {request_id, deny_id}
        assert all(row["status"] == "pending" for row in listed.json()["data"])

        brands = await app_client.get("/api/admin/brands", headers=admin)
        pending_flags = {row["brandName"]: row["igChangePending"] for row in brands.json()["data"]}
        assert pending_flags["Acme Coffee"] is True
        assert pending_flags["Other"] is True

        detail = await app_client.get(f"/api/admin/brands/{brand.id}", headers=admin)
        pending = detail.json()["data"]["pendingIgChange"]
        assert pending["id"] == request_id
        assert pending["currentHandle"] == "acmecoffee"
        assert pending["requestedHandle"] == "acme.new"
        assert pending["reason"] == "We are rebranding the shop."
        assert "createdAt" in pending

        approved = await app_client.post(
            f"/api/admin/brand-ig-change-requests/{request_id}/approve",
            headers=admin,
        )
        assert approved.status_code == 200, approved.text
        assert approved.json()["data"]["status"] == "approved"
        await db_session.refresh(brand)
        assert brand.instagram_handle == "acme.new"

        again = await app_client.post(
            f"/api/admin/brand-ig-change-requests/{request_id}/approve",
            headers=admin,
        )
        assert again.status_code == 400
        assert again.json()["error"]["code"] == errors.INVALID_ONBOARDING_STATE

        denied_res = await app_client.post(
            f"/api/admin/brand-ig-change-requests/{deny_id}/deny",
            headers=admin,
        )
        assert denied_res.status_code == 200
        assert denied_res.json()["data"]["status"] == "denied"
        await db_session.refresh(other)
        assert other.instagram_handle == "otherbrand"

        detail_after = await app_client.get(f"/api/admin/brands/{brand.id}", headers=admin)
        assert detail_after.json()["data"]["pendingIgChange"] is None
        assert detail_after.json()["data"]["instagramHandle"] == "acme.new"

        state = await app_client.get("/api/brands/me/ig-change-request", headers=_headers(user))
        assert state.json()["data"]["pending"] is None
        assert state.json()["data"]["latest"]["status"] == "approved"

    async def test_admin_auth_and_unknown_status(self, app_client: AsyncClient, db_session):
        user, _brand_row = await _brand(db_session)
        res = await app_client.get("/api/admin/brand-ig-change-requests")
        assert res.status_code == 401
        res = await app_client.get(
            "/api/admin/brand-ig-change-requests",
            headers=_headers(user),
        )
        assert res.status_code == 403
        admin = await _admin_headers(db_session)
        bad = await app_client.get(
            "/api/admin/brand-ig-change-requests?status=nope",
            headers=admin,
        )
        assert bad.status_code == 400
        missing = await app_client.post(
            f"/api/admin/brand-ig-change-requests/{uuid.uuid4()}/deny",
            headers=admin,
        )
        assert missing.status_code == 404

    async def test_erase_deletes_pending_request(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        monkeypatch.setattr(
            "app.services.admin_erase.send_brand_erased_email",
            AsyncMock(return_value=True),
        )
        user, brand = await _brand(db_session, email="erase-me@example.test")
        created = await app_client.post(
            "/api/brands/me/ig-change-requests",
            json={"requestedHandle": "gone.handle", "reason": "This should disappear on erase."},
            headers=_headers(user),
        )
        assert created.status_code == 200, created.text
        admin = await _admin_headers(db_session)
        erased = await app_client.post(
            f"/api/admin/brands/{brand.id}/erase",
            json={"confirm": "erase-me@example.test"},
            headers=admin,
        )
        assert erased.status_code == 200, erased.text
        remaining = await db_session.scalar(
            select(func.count())
            .select_from(BrandIgChangeRequest)
            .where(BrandIgChangeRequest.brand_id == brand.id)
        )
        assert remaining == 0

    async def test_submit_rate_limited(
        self, app_client: AsyncClient, db_session, _enable_rate_limit
    ):
        user, _brand_row = await _brand(db_session)
        statuses = []
        for _ in range(11):
            res = await app_client.post(
                "/api/brands/me/ig-change-requests",
                json={"requestedHandle": "bad handle", "reason": "x"},
                headers=_headers(user),
            )
            statuses.append(res.status_code)
        assert statuses[:10] == [400] * 10
        assert statuses[10] == 429
