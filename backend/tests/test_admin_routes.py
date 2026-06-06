"""Tests for admin routes (architecture.md §8.5)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy import select

from app.models.application import DropApplication
from app.models.enums import (
    ApplicationDecision,
    BrandStatus,
    BrandTrackerStage,
    OrgUserStatus,
    PortalRole,
)
from app.models.tracker_event import DropTrackerEvent
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
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, org_user)
        await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)

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
