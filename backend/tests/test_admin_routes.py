"""Tests for admin routes (architecture.md §8.5)."""

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
    BrandTrackerStage,
    OrgUserStatus,
    PortalRole,
)
from app.models.tracker_event import DropTrackerEvent
from app.models.user import User
from app.security.password import hash_password
from tests.conftest import (
    make_application,
    make_brand,
    make_drop,
    make_drop_request,
    make_org,
    make_user,
    mint_access_token,
    persist,
)


async def _admin_headers(db_session) -> dict:
    """Auth headers for a persisted admin user."""
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


class TestAdminGate:
    async def test_non_admin_forbidden(self, app_client: AsyncClient, db_session):
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        headers = {"Authorization": f"Bearer {mint_access_token(org_user)}"}
        res = await app_client.get("/api/admin/orgs/pending", headers=headers)
        assert res.status_code == 403

    async def test_unauthorized(self, app_client: AsyncClient):
        res = await app_client.get("/api/admin/orgs/pending")
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
            "/api/admin/orgs/pending", headers=await _admin_headers(db_session)
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
            "/api/admin/orgs/pending", headers=await _admin_headers(db_session)
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
            headers=await _admin_headers(db_session),
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
            headers=await _admin_headers(db_session),
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
            headers=await _admin_headers(db_session),
            json={"testerInviteConfirmed": True},
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "INVALID_ONBOARDING_STATE"

    async def test_approve_nonexistent_org(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            "/api/admin/orgs/00000000-0000-0000-0000-000000000099/approve",
            headers=await _admin_headers(db_session),
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
            f"/api/admin/orgs/{org.id}/deny", headers=await _admin_headers(db_session)
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
            f"/api/admin/orgs/{org.id}/deny", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "INVALID_ONBOARDING_STATE"

    async def test_deny_nonexistent_org(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            "/api/admin/orgs/00000000-0000-0000-0000-000000000099/deny",
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 404


class TestPendingBrands:
    async def test_returns_pending_review_brands(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session, brand_name="Pending Brand")
        brand.status = BrandStatus.PENDING_REVIEW.value
        await db_session.flush()

        res = await app_client.get(
            "/api/admin/brands/pending", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) == 1
        assert data[0]["brandName"] == "Pending Brand"

    async def test_excludes_approved_brands(self, app_client: AsyncClient, db_session):
        await make_brand(db_session, brand_name="Approved Brand")
        # make_brand creates with status=APPROVED by default

        res = await app_client.get(
            "/api/admin/brands/pending", headers=await _admin_headers(db_session)
        )
        assert len(res.json()["data"]) == 0


class TestApproveBrand:
    async def test_approves_brand(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session, brand_name="To Approve")
        brand.status = BrandStatus.PENDING_REVIEW.value
        await db_session.flush()

        res = await app_client.post(
            f"/api/admin/brands/{brand.id}/approve", headers=await _admin_headers(db_session)
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
            f"/api/admin/brands/{brand.id}/approve", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "INVALID_ONBOARDING_STATE"

    async def test_approve_nonexistent_brand(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            "/api/admin/brands/00000000-0000-0000-0000-000000000099/approve",
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 404


class TestTrackerAdvance:
    async def _setup_tracker_test(self, db_session):
        """Create a brand + drop in request_received stage."""
        brand = await make_brand(db_session, brand_name="Tracker Brand")
        drop = await make_drop(
            db_session,
            brand,
            stage=BrandTrackerStage.REQUEST_RECEIVED,
        )
        return drop

    async def test_advances_stage(self, app_client: AsyncClient, db_session):
        drop = await self._setup_tracker_test(db_session)

        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}/tracker",
            json={"stage": "finalizing_agreements", "note": "Moving forward"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200
        assert res.json()["data"]["stage"] == "finalizing_agreements"

        # Verify DB
        await db_session.refresh(drop)
        assert drop.brand_tracker_stage == BrandTrackerStage.FINALIZING_AGREEMENTS.value

        # Verify tracker event created
        events = list(
            await db_session.scalars(
                select(DropTrackerEvent).where(DropTrackerEvent.drop_id == drop.id)
            )
        )
        assert len(events) == 1
        assert events[0].stage == BrandTrackerStage.FINALIZING_AGREEMENTS.value
        assert events[0].note == "Moving forward"

    async def test_forward_only(self, app_client: AsyncClient, db_session):
        drop = await self._setup_tracker_test(db_session)

        # Advance to finalizing_agreements first
        await app_client.patch(
            f"/api/admin/drops/{drop.id}/tracker",
            json={"stage": "finalizing_agreements"},
            headers=await _admin_headers(db_session),
        )

        # Try to go back to request_received
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}/tracker",
            json={"stage": "request_received"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"

    async def test_invalid_stage_name(self, app_client: AsyncClient, db_session):
        drop = await self._setup_tracker_test(db_session)

        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}/tracker",
            json={"stage": "nonexistent_stage"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400

    async def test_tracking_number_on_awaiting_products(self, app_client: AsyncClient, db_session):
        """Tracking number is stored on the drop when advancing to awaiting_products."""
        brand = await make_brand(db_session, brand_name="TN Brand")
        drop = await make_drop(
            db_session,
            brand,
            stage=BrandTrackerStage.FINALIZING_AGREEMENTS,
            apply_open_at=datetime.now(timezone.utc) - timedelta(days=30),
            apply_close_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        # Selection must be finalized before advancing past finalizing_agreements.
        drop.applicant_selection_finalized_at = datetime.now(timezone.utc)
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, org_user)
        await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
        await db_session.flush()

        # Advance to awaiting_products with tracking number
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}/tracker",
            json={"stage": "awaiting_products", "tracking_number": "TRACK-123"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200

        # Verify tracking number stored on the drop (SOT)
        await db_session.refresh(drop)
        assert drop.tracking_number == "TRACK-123"

    async def test_drop_not_found(self, app_client: AsyncClient, db_session):
        res = await app_client.patch(
            "/api/admin/drops/00000000-0000-0000-0000-000000000099/tracker",
            json={"stage": "finalizing_agreements"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 404


class TestReopenDrop:
    async def test_reopens_drop(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)

        res = await app_client.post(
            f"/api/admin/drops/{drop.id}/reopen", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 200
        assert res.json()["data"]["manualReopen"] is True

        await db_session.refresh(drop)
        assert drop.manual_reopen is True

    async def test_reopen_nonexistent_drop(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            "/api/admin/drops/00000000-0000-0000-0000-000000000099/reopen",
            headers=await _admin_headers(db_session),
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
        headers = await _admin_headers(db_session)

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
        headers = await _admin_headers(db_session)

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
        headers = await _admin_headers(db_session)

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
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400

    async def test_clear_reopen(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, manual_reopen=True)
        headers = await _admin_headers(db_session)

        res = await app_client.post(f"/api/admin/drops/{drop.id}/clear-reopen", headers=headers)
        assert res.status_code == 200
        assert res.json()["data"]["manualReopen"] is False
        await db_session.refresh(drop)
        assert drop.manual_reopen is False

    async def test_clear_instagram_token(self, app_client: AsyncClient, db_session):
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        user.instagram_access_token = "tok"
        user.instagram_token_expires_at = datetime.now(timezone.utc)
        user.token_version = 1
        await db_session.flush()
        headers = await _admin_headers(db_session)

        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/clear-instagram-token", headers=headers
        )
        assert res.status_code == 200
        await db_session.refresh(user)
        assert user.instagram_access_token is None
        assert user.instagram_token_expires_at is None
        assert user.token_version == 2

    async def test_set_tracking_repair(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, stage=BrandTrackerStage.AWAITING_PRODUCTS)
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, org_user)
        await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
        headers = await _admin_headers(db_session)

        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}/tracking",
            json={"trackingNumber": "REPAIR-99"},
            headers=headers,
        )
        assert res.status_code == 200
        await db_session.refresh(drop)
        assert drop.tracking_number == "REPAIR-99"

    async def test_set_tracking_rejected_before_awaiting(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, stage=BrandTrackerStage.FINALIZING_AGREEMENTS)
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}/tracking",
            json={"trackingNumber": "TOO-EARLY"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400

    async def test_awaiting_products_requires_tracking(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, stage=BrandTrackerStage.FINALIZING_AGREEMENTS)
        drop.applicant_selection_finalized_at = datetime.now(timezone.utc)
        await db_session.flush()

        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}/tracker",
            json={"stage": "awaiting_products"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400

    async def test_non_admin_forbidden_on_recovery(self, app_client: AsyncClient, db_session):
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        headers = {"Authorization": f"Bearer {mint_access_token(org_user)}"}
        brand = await make_brand(db_session)
        res = await app_client.post(f"/api/admin/brands/{brand.id}/undeny", headers=headers)
        assert res.status_code == 403


class TestAdminCreateBrand:
    async def test_admin_create_without_approve(self, app_client: AsyncClient, db_session):
        headers = await _admin_headers(db_session)
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
        headers = await _admin_headers(db_session)
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
        headers = await _admin_headers(db_session)
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
        headers = await _admin_headers(db_session)
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

        headers = await _admin_headers(db_session)
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
            headers=await _admin_headers(db_session),
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
            headers=await _admin_headers(db_session),
        )
        assert admin.status_code == 200, admin.text


class TestDropConfigPatch:
    async def test_happy_path_all_fields(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        open_ms = int((datetime.now(timezone.utc) + timedelta(days=2)).timestamp() * 1000)
        close_ms = int((datetime.now(timezone.utc) + timedelta(days=9)).timestamp() * 1000)
        headers = await _admin_headers(db_session)

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
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200
        assert res.json()["data"]["capacityTotal"] == 7

    async def test_omit_vs_null(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, total_product_units=10)
        drop.campaign_hashtag = "keepme"
        await db_session.flush()
        headers = await _admin_headers(db_session)

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
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 422

    async def test_missing_drop_404(self, app_client: AsyncClient, db_session):
        res = await app_client.patch(
            "/api/admin/drops/00000000-0000-0000-0000-000000000099",
            json={"capacityTotal": 3},
            headers=await _admin_headers(db_session),
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
            headers=await _admin_headers(db_session),
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
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400

    async def test_live_stage_blocks_logistics(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_ACTIVE)
        headers = await _admin_headers(db_session)

        blocked = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"capacityTotal": 9, "campaignHashtag": "x"},
            headers=headers,
        )
        assert blocked.status_code == 409

        ok = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"campaignHashtag": "liveok"},
            headers=headers,
        )
        assert ok.status_code == 200
        assert ok.json()["data"]["campaignHashtag"] == "liveok"

    async def test_mode_flip_after_finalize_409(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, total_product_units=10)
        drop.applicant_selection_finalized_at = datetime.now(timezone.utc)
        await db_session.flush()
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"totalProductUnits": None},
            headers=await _admin_headers(db_session),
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
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200
        assert res.json()["data"]["campaignHashtag"] is None

    async def test_admin_patch_image_https_on_draft(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, published_at=None)
        headers = await _admin_headers(db_session)
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

    async def test_admin_patch_creative_blocked_after_publish(
        self, app_client: AsyncClient, db_session
    ):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"title": "New title", "image": "https://cdn.example.test/new.png"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 409


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

        async def _capture(to_email, *, brand_name="", drop_title="", drop_url=""):
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
        headers = await _admin_headers(db_session)

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
        assert pub["stage"] == "awaiting_products"

        events = list(await db_session.scalars(select(DropTrackerEvent)))
        assert any(
            str(evt.drop_id) == drop_id and evt.stage == "awaiting_products" for evt in events
        )
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
            headers=await _admin_headers(db_session),
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
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 422


class TestCleanupRequestReceived:
    async def test_cleanup_migrates_stubs_to_tickets(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        stub = await make_drop(
            db_session,
            brand,
            title="Stub request",
            stage=BrandTrackerStage.REQUEST_RECEIVED,
            published_at=None,
        )
        live = await make_drop(
            db_session,
            brand,
            title="Live campaign",
            stage=BrandTrackerStage.AWAITING_PRODUCTS,
        )
        headers = await _admin_headers(db_session)
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
            stage=BrandTrackerStage.REQUEST_RECEIVED,
            published_at=None,
        )
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
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 403
