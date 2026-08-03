"""Tests for admin routes (architecture.md §8.5)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy import select

from app.models.application import DropApplication
from app.models.brand_invite_token import BrandInviteToken
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
            f"/api/admin/orgs/{org.id}/approve", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["status"] == "active"

        # Verify DB state
        await db_session.refresh(user)
        await db_session.refresh(org)
        assert user.status == OrgUserStatus.ACTIVE.value
        assert org.approved_at is not None

    async def test_approve_wrong_state(self, app_client: AsyncClient, db_session):
        user = await persist(
            db_session, make_user(role=PortalRole.ORG, status=OrgUserStatus.ACTIVE)
        )
        org = await make_org(db_session, user, org_name="Already Active")

        res = await app_client.post(
            f"/api/admin/orgs/{org.id}/approve", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "INVALID_ONBOARDING_STATE"

    async def test_approve_nonexistent_org(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            "/api/admin/orgs/00000000-0000-0000-0000-000000000099/approve",
            headers=await _admin_headers(db_session),
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
        """Tracking number should be mirrored to accepted applications at awaiting_products."""
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

        # Verify tracking number mirrored
        app = await db_session.scalar(
            select(DropApplication).where(
                DropApplication.drop_id == drop.id, DropApplication.org_id == org.id
            )
        )
        assert app.tracking_number == "TRACK-123"

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
    async def test_undeny_org(self, app_client: AsyncClient, db_session):
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

        # Wrong state rejected
        res = await app_client.post(f"/api/admin/orgs/{org.id}/undeny", headers=headers)
        assert res.status_code == 400

    async def test_undeny_brand(self, app_client: AsyncClient, db_session):
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
        app = await db_session.scalar(
            select(DropApplication).where(
                DropApplication.drop_id == drop.id,
                DropApplication.org_id == org.id,
            )
        )
        assert app is not None
        assert app.tracking_number == "REPAIR-99"

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
