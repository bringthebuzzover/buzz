"""Tests for admin routes (buzz-ops engineering/architecture.md §8.5)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy import select

from app.models.brand_invite_token import BrandInviteToken
from app.models.drop import Drop
from app.models.drop_request import DropRequest
from app.models.enums import (
    ApplicationDecision,
    BrandStatus,
    OrgUserStatus,
    PortalRole,
)
from app.models.tracker_event import DropTrackerEvent
from app.models.user import User
from app.security.password import hash_password
from tests.conftest import (
    admin_headers,
    make_application,
    make_brand,
    make_drop,
    make_drop_request,
    make_org,
    make_user,
    mint_access_token,
    persist,
)


class TestAdminGate:
    async def test_non_admin_forbidden(self, app_client: AsyncClient, db_session):
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        headers = {"Authorization": f"Bearer {mint_access_token(org_user)}"}
        res = await app_client.get("/api/admin/orgs", headers=headers)
        assert res.status_code == 403

    async def test_unauthorized(self, app_client: AsyncClient):
        res = await app_client.get("/api/admin/orgs")
        assert res.status_code == 401


class TestPendingOrgs:
    async def test_returns_pending_approval_orgs(self, app_client: AsyncClient, db_session):
        # Create an org user with pending_approval status
        user = await persist(
            db_session,
            make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_APPROVAL),
        )
        await make_org(db_session, user, org_name="Pending Org")

        res = await app_client.get(
            "/api/admin/orgs?status=pending_approval", headers=await admin_headers(db_session)
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) == 1
        assert data[0]["orgName"] == "Pending Org"

    async def test_excludes_active_orgs(self, app_client: AsyncClient, db_session):
        user = await persist(
            db_session, make_user(role=PortalRole.ORG, status=OrgUserStatus.ACTIVE)
        )
        await make_org(db_session, user, org_name="Active Org")

        res = await app_client.get(
            "/api/admin/orgs?status=pending_approval", headers=await admin_headers(db_session)
        )
        assert res.status_code == 200
        assert len(res.json()["data"]) == 0


class TestApproveOrg:
    async def test_approves_org(self, app_client: AsyncClient, db_session):
        user = await persist(
            db_session,
            make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_APPROVAL),
        )
        org = await make_org(db_session, user, org_name="To Approve")

        res = await app_client.post(
            f"/api/admin/orgs/{org.id}/approve",
            headers=await admin_headers(db_session),
            json={"testerInviteConfirmed": True},
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["status"] == "pending_instagram"

        await db_session.refresh(user)
        await db_session.refresh(org)
        assert user.status == OrgUserStatus.PENDING_INSTAGRAM.value
        assert org.approved_at is not None

    async def test_approve_requires_tester_confirm(self, app_client: AsyncClient, db_session):
        user = await persist(
            db_session,
            make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_APPROVAL),
        )
        org = await make_org(db_session, user, org_name="No Confirm")

        res = await app_client.post(
            f"/api/admin/orgs/{org.id}/approve",
            headers=await admin_headers(db_session),
            json={"testerInviteConfirmed": False},
        )
        assert res.status_code == 400

    async def test_approve_wrong_state(self, app_client: AsyncClient, db_session):
        user = await persist(
            db_session, make_user(role=PortalRole.ORG, status=OrgUserStatus.ACTIVE)
        )
        org = await make_org(db_session, user, org_name="Already Active")

        res = await app_client.post(
            f"/api/admin/orgs/{org.id}/approve",
            headers=await admin_headers(db_session),
            json={"testerInviteConfirmed": True},
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "INVALID_ONBOARDING_STATE"

    async def test_approve_nonexistent_org(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            "/api/admin/orgs/00000000-0000-0000-0000-000000000099/approve",
            headers=await admin_headers(db_session),
            json={"testerInviteConfirmed": True},
        )
        assert res.status_code == 404


class TestDenyOrg:
    async def test_denies_org(self, app_client: AsyncClient, db_session):
        user = await persist(
            db_session,
            make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_APPROVAL),
        )
        org = await make_org(db_session, user, org_name="To Deny")

        res = await app_client.post(
            f"/api/admin/orgs/{org.id}/deny", headers=await admin_headers(db_session)
        )
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "denied"

        await db_session.refresh(user)
        assert user.status == OrgUserStatus.DENIED.value

    async def test_deny_wrong_state(self, app_client: AsyncClient, db_session):
        user = await persist(
            db_session, make_user(role=PortalRole.ORG, status=OrgUserStatus.ACTIVE)
        )
        org = await make_org(db_session, user)

        res = await app_client.post(
            f"/api/admin/orgs/{org.id}/deny", headers=await admin_headers(db_session)
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "INVALID_ONBOARDING_STATE"

    async def test_deny_nonexistent_org(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            "/api/admin/orgs/00000000-0000-0000-0000-000000000099/deny",
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 404


class TestPendingBrands:
    async def test_returns_pending_review_brands(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session, brand_name="Pending Brand")
        brand.status = BrandStatus.PENDING_REVIEW.value
        await db_session.flush()

        res = await app_client.get(
            "/api/admin/brands?status=pending_review", headers=await admin_headers(db_session)
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) == 1
        assert data[0]["brandName"] == "Pending Brand"

    async def test_excludes_approved_brands(self, app_client: AsyncClient, db_session):
        await make_brand(db_session, brand_name="Approved Brand")
        # make_brand creates with status=APPROVED by default

        res = await app_client.get(
            "/api/admin/brands?status=pending_review", headers=await admin_headers(db_session)
        )
        assert len(res.json()["data"]) == 0


class TestApproveBrand:
    async def test_approves_brand(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session, brand_name="To Approve")
        brand.status = BrandStatus.PENDING_REVIEW.value
        await db_session.flush()

        res = await app_client.post(
            f"/api/admin/brands/{brand.id}/approve", headers=await admin_headers(db_session)
        )
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "approved"

        await db_session.refresh(brand)
        assert brand.status == BrandStatus.APPROVED.value
        assert brand.approved_at is not None

    async def test_approve_wrong_state(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        # make_brand creates with status=APPROVED

        res = await app_client.post(
            f"/api/admin/brands/{brand.id}/approve", headers=await admin_headers(db_session)
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "INVALID_ONBOARDING_STATE"

    async def test_approve_nonexistent_brand(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            "/api/admin/brands/00000000-0000-0000-0000-000000000099/approve",
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 404


class TestWrapDrop:
    async def test_wrap_and_unwrap(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        now = datetime.now(timezone.utc)
        drop = await make_drop(
            db_session,
            brand,
            apply_open_at=now - timedelta(days=3),
            apply_close_at=now - timedelta(days=1),
        )
        headers = await admin_headers(db_session)

        res = await app_client.post(f"/api/admin/drops/{drop.id}/wrap", headers=headers)
        assert res.status_code == 200, res.text
        assert res.json()["data"]["stage"] == "wrapped"
        await db_session.refresh(drop)
        assert drop.wrapped_at is not None
        events = list(
            await db_session.scalars(
                select(DropTrackerEvent).where(DropTrackerEvent.drop_id == drop.id)
            )
        )
        assert [e.stage for e in events] == ["wrapped"]

        res = await app_client.post(f"/api/admin/drops/{drop.id}/unwrap", headers=headers)
        assert res.status_code == 200
        assert res.json()["data"]["stage"] == "selecting"
        await db_session.refresh(drop)
        assert drop.wrapped_at is None

    async def test_wrap_refused_while_open_or_hidden(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        now = datetime.now(timezone.utc)
        applying = await make_drop(db_session, brand)
        upcoming = await make_drop(
            db_session,
            brand,
            apply_open_at=now + timedelta(days=1),
            apply_close_at=now + timedelta(days=2),
        )
        hidden = await make_drop(
            db_session,
            brand,
            apply_open_at=now - timedelta(days=3),
            apply_close_at=now - timedelta(days=1),
        )
        hidden.hidden_at = now
        await db_session.flush()
        headers = await admin_headers(db_session)
        for drop in (applying, upcoming, hidden):
            res = await app_client.post(f"/api/admin/drops/{drop.id}/wrap", headers=headers)
            assert res.status_code == 409, res.text
            await db_session.refresh(drop)
            assert drop.wrapped_at is None

    async def test_wrap_draft_refused(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, published_at=None)
        res = await app_client.post(
            f"/api/admin/drops/{drop.id}/wrap", headers=await admin_headers(db_session)
        )
        assert res.status_code == 409

    async def test_wrap_unknown_drop(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            "/api/admin/drops/00000000-0000-0000-0000-000000000099/wrap",
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 404


class TestAdminRecovery:
    async def test_undeny_org(self, app_client: AsyncClient, db_session, monkeypatch):
        sent: list[tuple[str, str]] = []

        async def _capture(to_email: str, *, org_name: str = "") -> None:
            sent.append((to_email, org_name))

        monkeypatch.setattr("app.services.admin.send_org_undenied_email", _capture)

        user = await persist(
            db_session,
            make_user(role=PortalRole.ORG, status=OrgUserStatus.DENIED),
        )
        org = await make_org(db_session, user)
        headers = await admin_headers(db_session)

        res = await app_client.post(f"/api/admin/orgs/{org.id}/undeny", headers=headers)
        assert res.status_code == 200
        await db_session.refresh(user)
        assert user.status == OrgUserStatus.PENDING_APPROVAL.value
        assert sent == [(user.edu_email or "", org.org_name)]

        # Wrong state rejected
        res = await app_client.post(f"/api/admin/orgs/{org.id}/undeny", headers=headers)
        assert res.status_code == 400

    async def test_undeny_brand(self, app_client: AsyncClient, db_session, monkeypatch):
        sent: list[tuple[str, str]] = []

        async def _capture(to_email: str, *, brand_name: str = "") -> None:
            sent.append((to_email, brand_name))

        monkeypatch.setattr("app.services.admin.send_brand_undenied_email", _capture)

        brand = await make_brand(db_session)
        brand.status = BrandStatus.DENIED.value
        user = await db_session.get(User, brand.user_id)
        assert user is not None
        user.status = OrgUserStatus.DENIED.value
        await db_session.flush()
        headers = await admin_headers(db_session)

        res = await app_client.post(f"/api/admin/brands/{brand.id}/undeny", headers=headers)
        assert res.status_code == 200
        await db_session.refresh(brand)
        await db_session.refresh(user)
        assert brand.status == BrandStatus.PENDING_REVIEW.value
        assert user.status == OrgUserStatus.PENDING_APPROVAL.value
        assert sent == [(brand.company_email, brand.brand_name)]

    async def test_resend_invite(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        brand.status = BrandStatus.APPROVED.value
        user = await db_session.get(User, brand.user_id)
        assert user is not None
        user.password_hash = None
        await db_session.flush()
        headers = await admin_headers(db_session)

        res = await app_client.post(f"/api/admin/brands/{brand.id}/resend-invite", headers=headers)
        assert res.status_code == 200, res.text

        invite = await db_session.scalar(
            select(BrandInviteToken).where(BrandInviteToken.brand_id == brand.id)
        )
        assert invite is not None

    async def test_resend_invite_rejected_when_password_set(
        self, app_client: AsyncClient, db_session
    ):
        brand = await make_brand(db_session)
        user = await db_session.get(User, brand.user_id)
        assert user is not None
        user.password_hash = hash_password("Password1!")
        await db_session.flush()

        res = await app_client.post(
            f"/api/admin/brands/{brand.id}/resend-invite",
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 400

    async def test_clear_instagram_token(self, app_client: AsyncClient, db_session):
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        user.instagram_access_token = "tok"
        user.instagram_token_expires_at = datetime.now(timezone.utc)
        user.token_version = 1
        await db_session.flush()
        headers = await admin_headers(db_session)

        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/clear-instagram-token", headers=headers
        )
        assert res.status_code == 200
        await db_session.refresh(user)
        assert user.instagram_access_token is None
        assert user.instagram_token_expires_at is None
        assert user.token_version == 2

    async def test_drop_tracking_route_removed(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}/tracking",
            json={"trackingNumber": "REPAIR-99"},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 404

    async def test_non_admin_forbidden_on_recovery(self, app_client: AsyncClient, db_session):
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        headers = {"Authorization": f"Bearer {mint_access_token(org_user)}"}
        brand = await make_brand(db_session)
        res = await app_client.post(f"/api/admin/brands/{brand.id}/undeny", headers=headers)
        assert res.status_code == 403


class TestAdminCreateBrand:
    async def test_admin_create_without_approve(self, app_client: AsyncClient, db_session):
        headers = await admin_headers(db_session)
        res = await app_client.post(
            "/api/admin/brands",
            json={
                "brandName": "Invited Co",
                "companyEmail": "invite@brand.test",
                "instagramHandle": "@invited",
                "approveNow": False,
            },
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["status"] == BrandStatus.PENDING_REVIEW.value

    async def test_admin_create_approve_now(self, app_client: AsyncClient, db_session):
        headers = await admin_headers(db_session)
        res = await app_client.post(
            "/api/admin/brands",
            json={
                "brandName": "Approve Now Co",
                "companyEmail": "approve-now@brand.test",
                "approveNow": True,
            },
            headers=headers,
        )
        assert res.status_code == 200, res.text
        assert res.json()["data"]["status"] == BrandStatus.APPROVED.value
        assert res.json()["data"]["emailSent"] is True
        invite = await db_session.scalar(
            select(BrandInviteToken).where(BrandInviteToken.email == "approve-now@brand.test")
        )
        assert invite is not None

    async def test_admin_create_approve_now_email_failed(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        async def _fail(*_a, **_k):
            return False

        monkeypatch.setattr("app.services.admin.send_brand_invite_email", _fail)
        headers = await admin_headers(db_session)
        res = await app_client.post(
            "/api/admin/brands",
            json={
                "brandName": "Mail Fail Co",
                "companyEmail": "mail-fail@brand.test",
                "approveNow": True,
            },
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["status"] == BrandStatus.APPROVED.value
        assert data["emailSent"] is False
        invite = await db_session.scalar(
            select(BrandInviteToken).where(BrandInviteToken.email == "mail-fail@brand.test")
        )
        assert invite is not None

    async def test_approve_brand_email_failed(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        async def _fail(*_a, **_k):
            return False

        monkeypatch.setattr("app.services.admin.send_brand_invite_email", _fail)
        brand = await make_brand(db_session, company_email="approve-fail@brand.test")
        brand.status = BrandStatus.PENDING_REVIEW.value
        await db_session.flush()
        headers = await admin_headers(db_session)
        res = await app_client.post(
            f"/api/admin/brands/{brand.id}/approve",
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["status"] == BrandStatus.APPROVED.value
        assert data["emailSent"] is False

    async def test_resend_invite_email_failed(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        async def _fail(*_a, **_k):
            return False

        monkeypatch.setattr("app.services.admin.send_brand_invite_email", _fail)
        brand = await make_brand(db_session, company_email="resend-fail@brand.test")
        brand.status = BrandStatus.APPROVED.value
        user = await db_session.get(User, brand.user_id)
        assert user is not None
        user.password_hash = None
        await db_session.flush()

        headers = await admin_headers(db_session)
        res = await app_client.post(
            f"/api/admin/brands/{brand.id}/resend-invite",
            headers=headers,
        )
        assert res.status_code == 502, res.text
        assert res.json()["error"]["code"] == "EMAIL_SEND_FAILED"

    async def test_admin_create_duplicate_email(self, app_client: AsyncClient, db_session):
        await make_brand(db_session, company_email="dup@brand.test")
        res = await app_client.post(
            "/api/admin/brands",
            json={
                "brandName": "Dup Co",
                "companyEmail": "dup@brand.test",
            },
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 409
        assert res.json()["error"]["code"] == "BRAND_EMAIL_TAKEN"

    async def test_public_apply_still_gated(self, app_client: AsyncClient, db_session, monkeypatch):
        from app.config import settings

        monkeypatch.setattr(settings, "BRAND_SELF_REGISTRATION_ENABLED", False)
        public = await app_client.post(
            "/api/brands/apply",
            json={"brandName": "Nope", "companyEmail": "nope@brand.test"},
        )
        assert public.status_code == 403

        admin = await app_client.post(
            "/api/admin/brands",
            json={"brandName": "Admin Path", "companyEmail": "admin-path@brand.test"},
            headers=await admin_headers(db_session),
        )
        assert admin.status_code == 200, admin.text


class TestDropConfigPatch:
    async def test_happy_path_all_fields(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        open_ms = int((datetime.now(timezone.utc) + timedelta(days=2)).timestamp() * 1000)
        close_ms = int((datetime.now(timezone.utc) + timedelta(days=9)).timestamp() * 1000)
        headers = await admin_headers(db_session)

        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={
                "capacityTotal": 12,
                "applyOpenAt": open_ms,
                "applyCloseAt": close_ms,
                "totalProductUnits": 40,
                "campaignHashtag": "  #FooBar  ",
            },
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["capacityTotal"] == 12
        assert data["totalProductUnits"] == 40
        assert data["campaignHashtag"] == "foobar"
        assert data["applyOpenAt"] == open_ms
        assert data["applyCloseAt"] == close_ms

        await db_session.refresh(drop)
        assert drop.campaign_hashtag == "foobar"

    async def test_empty_body_noop(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, capacity_total=7)
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 200
        assert res.json()["data"]["capacityTotal"] == 7

    async def test_omit_vs_null(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, total_product_units=10)
        drop.campaign_hashtag = "keepme"
        await db_session.flush()
        headers = await admin_headers(db_session)

        omit = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"capacityTotal": 8},
            headers=headers,
        )
        assert omit.status_code == 200
        assert omit.json()["data"]["totalProductUnits"] == 10
        assert omit.json()["data"]["campaignHashtag"] == "keepme"

        clear = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"totalProductUnits": None, "campaignHashtag": None},
            headers=headers,
        )
        assert clear.status_code == 200
        assert clear.json()["data"]["totalProductUnits"] is None
        assert clear.json()["data"]["campaignHashtag"] is None

        bad = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"capacityTotal": None},
            headers=headers,
        )
        assert bad.status_code == 422

    async def test_unknown_key_forbidden(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"notARealField": "Nope"},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 422

    async def test_missing_drop_404(self, app_client: AsyncClient, db_session):
        res = await app_client.patch(
            "/api/admin/drops/00000000-0000-0000-0000-000000000099",
            json={"capacityTotal": 3},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 404

    async def test_non_admin_forbidden(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"capacityTotal": 3},
            headers={"Authorization": f"Bearer {mint_access_token(org_user)}"},
        )
        assert res.status_code == 403

    async def test_window_order_rejected(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        open_ms = int((datetime.now(timezone.utc) + timedelta(days=5)).timestamp() * 1000)
        close_ms = int((datetime.now(timezone.utc) + timedelta(days=1)).timestamp() * 1000)
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"applyOpenAt": open_ms, "applyCloseAt": close_ms},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 400

    async def test_capacity_below_accepted(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, capacity_total=5)
        user = await persist(db_session, make_user(instagram_user_id="ig_cap"))
        org = await make_org(db_session, user)
        await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
        await make_application(
            db_session,
            drop,
            await make_org(
                db_session,
                await persist(db_session, make_user(instagram_user_id="ig_cap2")),
            ),
            decision=ApplicationDecision.ACCEPTED,
        )
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"capacityTotal": 1},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 400

    async def test_only_copy_changes_after_wrap(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, wrapped_at=datetime.now(timezone.utc))
        headers = await admin_headers(db_session)

        ok = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"title": "Recap", "location": "Campus"},
            headers=headers,
        )
        assert ok.status_code == 200, ok.text
        assert ok.json()["data"]["title"] == "Recap"

        close_later = int(datetime.now(timezone.utc).timestamp() * 1000) + 86_400_000
        for body in (
            {"capacityTotal": 9},
            {"campaignHashtag": "late"},
            {"applyCloseAt": close_later},
            {"title": "Mixed", "capacityTotal": 9},
        ):
            blocked = await app_client.patch(
                f"/api/admin/drops/{drop.id}", json=body, headers=headers
            )
            assert blocked.status_code == 409, body
            assert blocked.json()["error"]["code"] == "DROP_WRAPPED"

    async def test_mode_flip_with_accepted_seat_409(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, total_product_units=10)
        org = await make_org(db_session, await persist(db_session, make_user(role=PortalRole.ORG)))
        await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"totalProductUnits": None},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 409

    async def test_hashtag_empty_clears(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        drop.campaign_hashtag = "old"
        await db_session.flush()
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"campaignHashtag": "#"},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 200
        assert res.json()["data"]["campaignHashtag"] is None

    async def test_admin_patch_image_https_on_draft(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, published_at=None)
        headers = await admin_headers(db_session)
        ok = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"image": "https://cdn.example.test/hero.png"},
            headers=headers,
        )
        assert ok.status_code == 200, ok.text
        assert ok.json()["data"]["image"] == "https://cdn.example.test/hero.png"

        http = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"image": "http://cdn.example.test/hero.png"},
            headers=headers,
        )
        assert http.status_code == 422

        placeholder = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"image": "https://placehold.co/600x400/png"},
            headers=headers,
        )
        assert placeholder.status_code == 422

    async def test_admin_patch_creative_allowed_after_publish(
        self, app_client: AsyncClient, db_session
    ):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"title": "New title", "image": "https://cdn.example.test/new.png"},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 200, res.text
        body = res.json()["data"]
        assert body["title"] == "New title"
        assert body["image"] == "https://cdn.example.test/new.png"


def _draft_body(**overrides: object) -> dict:
    now = datetime.now(timezone.utc)
    body: dict = {
        "title": "Campus Spring",
        "description": "Real campaign copy",
        "image": "https://cdn.example.test/hero.png",
        "location": "Bay Area",
        "capacityTotal": 8,
        "applyOpenAt": int((now + timedelta(days=1)).timestamp() * 1000),
        "applyCloseAt": int((now + timedelta(days=8)).timestamp() * 1000),
    }
    body.update(overrides)
    return body


class TestAdminCreateAndPublish:
    async def test_create_unpublished_and_publish(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        sent: list[dict] = []

        async def _capture(
            to_email, *, brand_name="", drop_title="", drop_url="", idempotency_key=None
        ):
            sent.append(
                {
                    "to": to_email,
                    "brand_name": brand_name,
                    "drop_title": drop_title,
                    "drop_url": drop_url,
                }
            )
            return True

        monkeypatch.setattr("app.services.admin.send_drop_published_email", _capture)

        brand = await make_brand(db_session, company_email="ops@acme.test")
        ticket = await make_drop_request(db_session, brand)
        headers = await admin_headers(db_session)

        created = await app_client.post(
            f"/api/admin/brands/{brand.id}/drops",
            json=_draft_body(dropRequestId=str(ticket.id)),
            headers=headers,
        )
        assert created.status_code == 200, created.text
        data = created.json()["data"]
        drop_id = data["id"]
        assert data["publishedAt"] is None
        assert data["title"] == "Campus Spring"
        assert data["brandCanEditCreative"] is False

        await db_session.refresh(ticket)
        assert ticket.status == "converted"
        assert str(ticket.converted_drop_id) == drop_id

        published = await app_client.post(
            f"/api/admin/drops/{drop_id}/publish",
            headers=headers,
        )
        assert published.status_code == 200, published.text
        pub = published.json()["data"]
        assert pub["publishedAt"] is not None
        assert pub["stage"] == "upcoming"

        events = list(await db_session.scalars(select(DropTrackerEvent)))
        assert any(str(evt.drop_id) == drop_id and evt.stage == "upcoming" for evt in events)
        assert len(sent) == 1
        assert sent[0]["to"] == "ops@acme.test"
        assert drop_id in sent[0]["drop_url"]
        assert sent[0]["drop_url"].endswith(f"/brand/drops/{drop_id}")

        again = await app_client.post(
            f"/api/admin/drops/{drop_id}/publish",
            headers=headers,
        )
        assert again.status_code == 409
        assert len(sent) == 1

    async def test_admin_create_rejects_non_https_image(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        ticket = await make_drop_request(db_session, brand)
        res = await app_client.post(
            f"/api/admin/brands/{brand.id}/drops",
            json=_draft_body(dropRequestId=str(ticket.id), image="http://cdn.example.test/x.png"),
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 422

    async def test_admin_create_rejects_placehold(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        ticket = await make_drop_request(db_session, brand)
        res = await app_client.post(
            f"/api/admin/brands/{brand.id}/drops",
            json=_draft_body(
                dropRequestId=str(ticket.id),
                image="https://placehold.co/600x400/png",
            ),
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 422

    async def test_create_persists_brand_can_edit_creative(
        self, app_client: AsyncClient, db_session
    ):
        brand = await make_brand(db_session)
        ticket = await make_drop_request(db_session, brand)
        res = await app_client.post(
            f"/api/admin/brands/{brand.id}/drops",
            json=_draft_body(dropRequestId=str(ticket.id), brandCanEditCreative=True),
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["brandCanEditCreative"] is True
        drop = await db_session.get(Drop, data["id"])
        assert drop is not None
        assert drop.brand_can_edit_creative is True


class TestAdminDropRequestFields:
    async def test_list_and_get_echo_structured_fields(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        ticket = await make_drop_request(db_session, brand, message="Structured", notes="n")
        ticket.product = "Cans"
        ticket.title = "Fall"
        ticket.location = "Bay Area"
        ticket.target_date = datetime.now(timezone.utc).date()
        ticket.org_count = 8
        ticket.units_per_org = 24
        ticket.campaign_hashtag = "Fall_Brew"
        await db_session.flush()
        headers = await admin_headers(db_session)

        one = await app_client.get(f"/api/admin/drop-requests/{ticket.id}", headers=headers)
        assert one.status_code == 200, one.text
        data = one.json()["data"]
        assert data["message"] == "Structured"
        assert data["product"] == "Cans"
        assert data["title"] == "Fall"
        assert data["location"] == "Bay Area"
        assert data["targetDate"] == ticket.target_date.isoformat()
        assert data["orgCount"] == 8
        assert data["unitsPerOrg"] == 24
        assert data["campaignHashtag"] == "Fall_Brew"
        assert data["notes"] == "n"
        assert data["brandName"] == brand.brand_name

        listed = await app_client.get("/api/admin/drop-requests", headers=headers)
        assert listed.status_code == 200, listed.text
        row = next(item for item in listed.json()["data"] if item["id"] == str(ticket.id))
        assert row["product"] == "Cans"
        assert row["orgCount"] == 8
        assert row["unitsPerOrg"] == 24


class TestCleanupRequestReceived:
    async def test_cleanup_migrates_stubs_to_tickets(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        stub = await make_drop(
            db_session,
            brand,
            title="Stub request",
            published_at=None,
        )
        stub.brand_tracker_stage = "request_received"  # legacy stub (cleared in PR5)
        await db_session.flush()
        live = await make_drop(
            db_session,
            brand,
            title="Live campaign",
        )
        headers = await admin_headers(db_session)
        stub_id = stub.id
        live_id = live.id
        brand_id = brand.id
        stub_description = stub.description
        res = await app_client.post(
            "/api/admin/tools/cleanup-request-received",
            headers=headers,
        )
        assert res.status_code == 200, res.text
        body = res.json()["data"]
        assert body["convertedCount"] == 1
        assert str(stub_id) in body["deletedDropIds"]

        db_session.expire_all()
        remaining = await db_session.get(Drop, live_id)
        assert remaining is not None
        gone = await db_session.get(Drop, stub_id)
        assert gone is None
        tickets = list(
            await db_session.scalars(select(DropRequest).where(DropRequest.brand_id == brand_id))
        )
        assert len(tickets) == 1
        assert tickets[0].status == "closed"
        assert tickets[0].message == stub_description

        again = await app_client.post(
            "/api/admin/tools/cleanup-request-received",
            headers=headers,
        )
        assert again.status_code == 200
        assert again.json()["data"]["convertedCount"] == 0

    async def test_cleanup_dry_run_does_not_delete(self, app_client: AsyncClient, db_session):
        from app.services.admin import cleanup_request_received_stubs

        brand = await make_brand(db_session)
        stub = await make_drop(
            db_session,
            brand,
            title="Stub request",
            published_at=None,
        )
        stub.brand_tracker_stage = "request_received"  # legacy stub (cleared in PR5)
        await db_session.flush()
        stub_id = stub.id
        result = await cleanup_request_received_stubs(db_session, dry_run=True)
        assert result["dry_run"] is True
        assert result["converted_count"] == 1
        assert stub_id in result["deleted_drop_ids"]
        db_session.expire_all()
        still = await db_session.get(Drop, stub_id)
        assert still is not None

    async def test_cleanup_blocked_in_production(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        from app.config import settings

        monkeypatch.setattr(settings, "ENVIRONMENT", "production")
        res = await app_client.post(
            "/api/admin/tools/cleanup-request-received",
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 403
