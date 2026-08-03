"""Tests for brand portal routes (architecture.md §8.1–§8.4)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy import select

from app.models.application import DropApplication
from app.models.enums import (
    ApplicationDecision,
    BrandTrackerStage,
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


async def _brand_ctx(db_session):
    """Create an active brand user + brand profile, return (user, brand, headers)."""
    brand_user = await persist(db_session, make_user(role=PortalRole.BRAND))
    brand = await make_brand(db_session, brand_name="Acme Test", company_email="brand@test.com")
    brand.user_id = brand_user.id
    await db_session.flush()
    headers = {"Authorization": f"Bearer {mint_access_token(brand_user)}"}
    return brand_user, brand, headers


class TestGetBrandProfile:
    async def test_returns_profile(self, app_client: AsyncClient, db_session):
        _, brand, headers = await _brand_ctx(db_session)
        res = await app_client.get("/api/brands/me", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["id"] == str(brand.id)
        assert data["brandName"] == "Acme Test"
        assert data["companyEmail"] == "brand@test.com"
        assert "approvedAt" in data
        assert "createdAt" in data

    async def test_unauthorized(self, app_client: AsyncClient):
        res = await app_client.get("/api/brands/me")
        assert res.status_code == 401

    async def test_org_user_forbidden(self, app_client: AsyncClient, db_session):
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        res = await app_client.get("/api/brands/me", headers=headers)
        assert res.status_code == 403


class TestCreateDrop:
    async def test_creates_drop_with_defaults(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        res = await app_client.post(
            "/api/brands/me/drops",
            json={"title": "Test Drop", "description": "A test drop"},
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["title"] == "Test Drop"
        assert data["capacityTotal"] == 10
        assert data["brandTrackerStage"] == "request_received"
        assert data["image"] == "https://placehold.co/600x400/png"
        assert data["location"] == "Multiple Campuses"
        assert data["totalProductUnits"] is None
        # Verify tracker event was created
        event = await db_session.scalar(
            select(DropTrackerEvent).where(DropTrackerEvent.drop_id == data["id"])
        )
        assert event is not None
        assert event.stage == "request_received"

    async def test_org_user_forbidden(self, app_client: AsyncClient, db_session):
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        res = await app_client.post(
            "/api/brands/me/drops",
            json={"title": "Nope", "description": "should not work"},
            headers=headers,
        )
        assert res.status_code == 403


class TestListBrandDrops:
    async def test_returns_drops_with_aggregates(self, app_client: AsyncClient, db_session):
        _, brand, headers = await _brand_ctx(db_session)
        await make_drop(db_session, brand, title="Drop 1")
        await make_drop(db_session, brand, title="Drop 2")

        res = await app_client.get("/api/brands/me/drops", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) == 2
        for item in data:
            assert "totalPosts" in item
            assert "totalLikes" in item
            assert "totalComments" in item
            assert "totalEngagement" in item
            assert "totalReach" in item

    async def test_empty_list(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        res = await app_client.get("/api/brands/me/drops", headers=headers)
        assert res.status_code == 200
        assert res.json()["data"] == []

    async def test_only_own_drops(self, app_client: AsyncClient, db_session):
        _, brand, headers = await _brand_ctx(db_session)
        other_brand = await make_brand(db_session, brand_name="Other")
        await make_drop(db_session, brand, title="Mine")
        await make_drop(db_session, other_brand, title="Theirs")

        res = await app_client.get("/api/brands/me/drops", headers=headers)
        data = res.json()["data"]
        assert len(data) == 1
        assert data[0]["title"] == "Mine"


class TestGetBrandDropDetail:
    async def test_returns_detail_with_applicants(self, app_client: AsyncClient, db_session):
        user, brand, headers = await _brand_ctx(db_session)
        drop = await make_drop(db_session, brand)
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, org_user)
        await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)

        res = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["title"] == drop.title
        assert len(data["applications"]) == 1
        app = data["applications"][0]
        assert app["orgName"] == org.org_name
        assert "attributedPostCount" in app
        assert "attributedLikes" in app
        assert "attributedEngagement" in app
        assert "totalEngagement" in data
        assert "totalReach" in data
        assert "totalPosts" in data

    async def test_404_for_other_brand_drop(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        other_brand = await make_brand(db_session, brand_name="Other")
        drop = await make_drop(db_session, other_brand)
        res = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=headers)
        assert res.status_code == 404

    async def test_404_unknown_drop(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        res = await app_client.get(
            "/api/brands/me/drops/00000000-0000-0000-0000-000000000099",
            headers=headers,
        )
        assert res.status_code == 404


class TestFinalizeApplicants:
    async def _setup_finalize(self, db_session, *, with_units: bool = False):
        """Create brand + drop in finalizing_agreements with applied orgs."""
        user = await persist(db_session, make_user(role=PortalRole.BRAND))
        brand = await make_brand(db_session, brand_name="Finalize Brand")
        brand.user_id = user.id
        await db_session.flush()
        headers = {"Authorization": f"Bearer {mint_access_token(user)}"}

        total_units = 100 if with_units else None
        drop = await make_drop(
            db_session,
            brand,
            title="Finalize Drop",
            capacity_total=3,
            stage=BrandTrackerStage.FINALIZING_AGREEMENTS,
            total_product_units=total_units,
            apply_open_at=datetime.now(timezone.utc) - timedelta(days=30),
            apply_close_at=datetime.now(timezone.utc) - timedelta(days=1),
        )

        orgs = []
        for name in ["Org A", "Org B", "Org C"]:
            org_user = await persist(db_session, make_user(role=PortalRole.ORG))
            org = await make_org(db_session, org_user, org_name=name)
            await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)
            orgs.append(org)

        return brand, drop, orgs, headers

    async def test_happy_path_spot_only(self, app_client: AsyncClient, db_session):
        _, drop, orgs, headers = await self._setup_finalize(db_session, with_units=False)
        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={
                "allocations": [
                    {"orgId": str(orgs[0].id), "units": 0},
                    {"orgId": str(orgs[2].id), "units": 0},
                ]
            },
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["acceptedCount"] == 2
        assert data["deniedCount"] == 1

        # Verify DB state
        apps = list(
            await db_session.scalars(
                select(DropApplication).where(DropApplication.drop_id == drop.id)
            )
        )
        decisions = {str(a.org_id): a.decision for a in apps}
        assert decisions[str(orgs[0].id)] == "accepted"
        assert decisions[str(orgs[1].id)] == "denied"
        assert decisions[str(orgs[2].id)] == "accepted"

        # Verify drop timestamp stamped
        await db_session.refresh(drop)
        assert drop.applicant_selection_finalized_at is not None

    async def test_happy_path_with_units(self, app_client: AsyncClient, db_session):
        _, drop, orgs, headers = await self._setup_finalize(db_session, with_units=True)
        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={
                "allocations": [
                    {"orgId": str(orgs[0].id), "units": 30},
                    {"orgId": str(orgs[1].id), "units": 50},
                ]
            },
            headers=headers,
        )
        assert res.status_code == 200
        # Verify allocated_units stored
        app = await db_session.scalar(
            select(DropApplication).where(
                DropApplication.drop_id == drop.id,
                DropApplication.org_id == orgs[0].id,
            )
        )
        assert app.allocated_units == 30

    async def test_drop_not_in_selection_stage(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        # Create a drop in request_received stage (not finalizing_agreements)
        brand_user = await persist(db_session, make_user(role=PortalRole.BRAND))
        brand = await make_brand(db_session, brand_name="Stage Brand")
        brand.user_id = brand_user.id
        await db_session.flush()
        drop = await make_drop(
            db_session,
            brand,
            stage=BrandTrackerStage.REQUEST_RECEIVED,
            apply_open_at=datetime.now(timezone.utc) - timedelta(days=30),
            apply_close_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={"allocations": []},
            headers={"Authorization": f"Bearer {mint_access_token(brand_user)}"},
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "DROP_NOT_IN_SELECTION_STAGE"

    async def test_apply_window_still_open(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        brand_user = await persist(db_session, make_user(role=PortalRole.BRAND))
        brand = await make_brand(db_session, brand_name="Window Brand")
        brand.user_id = brand_user.id
        await db_session.flush()
        drop = await make_drop(
            db_session,
            brand,
            stage=BrandTrackerStage.FINALIZING_AGREEMENTS,
            apply_open_at=datetime.now(timezone.utc) - timedelta(days=1),
            apply_close_at=datetime.now(timezone.utc) + timedelta(days=1),
        )
        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={"allocations": []},
            headers={"Authorization": f"Bearer {mint_access_token(brand_user)}"},
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "APPLY_WINDOW_OPEN"

    async def test_duplicate_org_id(self, app_client: AsyncClient, db_session):
        _, drop, orgs, headers = await self._setup_finalize(db_session)
        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={
                "allocations": [
                    {"orgId": str(orgs[0].id), "units": 0},
                    {"orgId": str(orgs[0].id), "units": 0},
                ]
            },
            headers=headers,
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"

    async def test_capacity_exceeded(self, app_client: AsyncClient, db_session):
        _, drop, orgs, headers = await self._setup_finalize(db_session)
        # Need a 4th org
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org4 = await make_org(db_session, org_user, org_name="Org D")
        await make_application(db_session, drop, org4, decision=ApplicationDecision.APPLIED)
        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={
                "allocations": [
                    {"orgId": str(orgs[0].id), "units": 0},
                    {"orgId": str(orgs[1].id), "units": 0},
                    {"orgId": str(orgs[2].id), "units": 0},
                    {"orgId": str(org4.id), "units": 0},
                ]
            },
            headers=headers,
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "CAPACITY_EXCEEDED"

    async def test_already_finalized(self, app_client: AsyncClient, db_session):
        _, drop, orgs, headers = await self._setup_finalize(db_session)
        # First finalize
        await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={"allocations": [{"orgId": str(orgs[0].id), "units": 0}]},
            headers=headers,
        )
        # Second finalize
        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={"allocations": [{"orgId": str(orgs[1].id), "units": 0}]},
            headers=headers,
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "ALREADY_FINALIZED"

    async def test_finalize_clears_manual_reopen(self, app_client: AsyncClient, db_session):
        _, drop, orgs, headers = await self._setup_finalize(db_session)
        drop.manual_reopen = True
        await db_session.flush()
        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={"allocations": [{"orgId": str(orgs[0].id), "units": 0}]},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        await db_session.refresh(drop)
        assert drop.manual_reopen is False

    async def test_org_not_applied(self, app_client: AsyncClient, db_session):
        _, drop, orgs, headers = await self._setup_finalize(db_session)
        # Create an org that hasn't applied
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        no_app_org = await make_org(db_session, org_user, org_name="No App")
        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={"allocations": [{"orgId": str(no_app_org.id), "units": 0}]},
            headers=headers,
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "ORG_NOT_APPLIED"

    async def test_404_other_brand(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        other = await make_brand(db_session, brand_name="Other")
        drop = await make_drop(
            db_session,
            other,
            stage=BrandTrackerStage.FINALIZING_AGREEMENTS,
            apply_open_at=datetime.now(timezone.utc) - timedelta(days=30),
            apply_close_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={"allocations": []},
            headers=headers,
        )
        assert res.status_code == 404

    async def test_empty_allocations_all_denied(self, app_client: AsyncClient, db_session):
        _, drop, orgs, headers = await self._setup_finalize(db_session)
        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={"allocations": []},
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["acceptedCount"] == 0
        assert data["deniedCount"] == 3

    async def test_unit_budget_exceeded(self, app_client: AsyncClient, db_session):
        _, drop, orgs, headers = await self._setup_finalize(db_session, with_units=True)
        # total_product_units=100, allocate 150
        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={
                "allocations": [
                    {"orgId": str(orgs[0].id), "units": 60},
                    {"orgId": str(orgs[1].id), "units": 60},
                ]
            },
            headers=headers,
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "UNIT_BUDGET_EXCEEDED"


class TestBrandAggregate:
    async def test_returns_zeros_for_no_drops(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        res = await app_client.get("/api/brands/me/aggregate", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["totalDrops"] == 0
        assert data["totalPosts"] == 0
        assert data["totalEngagement"] == 0

    async def test_counts_drops(self, app_client: AsyncClient, db_session):
        _, brand, headers = await _brand_ctx(db_session)
        await make_drop(db_session, brand)
        await make_drop(db_session, brand)
        res = await app_client.get("/api/brands/me/aggregate", headers=headers)
        assert res.json()["data"]["totalDrops"] == 2


class TestEngagementSeries:
    async def test_empty_for_no_posts(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        res = await app_client.get("/api/brands/me/engagement-series", headers=headers)
        assert res.status_code == 200
        assert res.json()["data"] == []

    async def test_returns_buckets(self, app_client: AsyncClient, db_session):
        _, brand, headers = await _brand_ctx(db_session)
        drop = await make_drop(db_session, brand)
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, org_user)
        app = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
        from tests.conftest import make_post_link, make_social_post

        post = await make_social_post(db_session, org, likes=10, comments=2)
        await make_post_link(db_session, post, app)

        res = await app_client.get("/api/brands/me/engagement-series", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) == 12
        for point in data:
            assert "timestamp" in point
            assert "engagement" in point
