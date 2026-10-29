"""Tests for brand portal routes (architecture.md §8.1–§8.4)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.drop_request import DropRequest
from app.models.enums import (
    ApplicationDecision,
    BrandTrackerStage,
    PortalRole,
    SocialMediaProductType,
)
from tests.conftest import (
    make_application,
    make_brand,
    make_drop,
    make_drop_request,
    make_org,
    make_post_link,
    make_social_post,
    make_user,
    mint_access_token,
    persist,
)


def _org_user(*, handle: str):
    """Org fixture user with a unique claimed handle (partial unique index)."""

    user = make_user(role=PortalRole.ORG)
    user.instagram_username = handle
    return user


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


def _ticket_body(**overrides: object) -> dict:
    body: dict = {"message": "Want a spring campus drop", "product": "Cold brew cans"}
    body.update(overrides)
    return body


class TestCreateDropRequest:
    async def test_creates_intake_ticket_not_drop(self, app_client: AsyncClient, db_session):
        _, brand, headers = await _brand_ctx(db_session)
        res = await app_client.post(
            "/api/brands/me/drop-requests",
            json=_ticket_body(notes="Southeast preferred"),
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["message"] == "Want a spring campus drop"
        assert data["product"] == "Cold brew cans"
        assert data["notes"] == "Southeast preferred"
        assert data["title"] is None
        assert data["location"] is None
        assert data["targetDate"] is None
        assert data["orgCount"] is None
        assert data["unitsPerOrg"] is None
        assert data["campaignHashtag"] is None
        assert data["status"] == "received"
        assert data["convertedDropId"] is None

        tickets = list(
            await db_session.scalars(select(DropRequest).where(DropRequest.brand_id == brand.id))
        )
        assert len(tickets) == 1
        drops = list(await db_session.scalars(select(Drop).where(Drop.brand_id == brand.id)))
        assert drops == []

    async def test_old_create_drop_path_gone(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        res = await app_client.post(
            "/api/brands/me/drops",
            json={"title": "Nope", "description": "Must not mint a drop"},
            headers=headers,
        )
        assert res.status_code == 405

    async def test_rate_limited(self, app_client: AsyncClient, db_session):
        from app.config import settings
        from app.security import rate_limit

        prev = settings.RATE_LIMIT_ENABLED
        settings.RATE_LIMIT_ENABLED = True
        rate_limit.reset()
        try:
            _, _, headers = await _brand_ctx(db_session)
            statuses = []
            for i in range(11):
                res = await app_client.post(
                    "/api/brands/me/drop-requests",
                    json=_ticket_body(message=f"Ticket {i}"),
                    headers=headers,
                )
                statuses.append(res.status_code)
            assert statuses[:10] == [200] * 10
            assert statuses[10] == 429
        finally:
            settings.RATE_LIMIT_ENABLED = prev
            rate_limit.reset()

    async def test_list(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        created = await app_client.post(
            "/api/brands/me/drop-requests",
            json=_ticket_body(message="Listed ticket"),
            headers=headers,
        )
        listed = await app_client.get("/api/brands/me/drop-requests", headers=headers)
        assert listed.status_code == 200
        rows = listed.json()["data"]
        assert [r["id"] for r in rows] == [created.json()["data"]["id"]]
        assert rows[0]["message"] == "Listed ticket"
        assert rows[0]["product"] == "Cold brew cans"

    async def test_org_user_forbidden(self, app_client: AsyncClient, db_session):
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        res = await app_client.post(
            "/api/brands/me/drop-requests",
            json=_ticket_body(message="Nope"),
            headers=headers,
        )
        assert res.status_code == 403

    async def test_echoes_structured_fields(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        today = datetime.now(timezone.utc).date()
        target = today + timedelta(days=30)
        res = await app_client.post(
            "/api/brands/me/drop-requests",
            json=_ticket_body(
                title="  Fall Cold Brew  ",
                location="  Bay Area  ",
                targetDate=target.isoformat(),
                orgCount=8,
                unitsPerOrg=24,
                campaignHashtag="  #Fall_Brew  ",
                notes="  Assets link  ",
                message="  Launch cold brew this fall.  ",
                product="  One case per org  ",
            ),
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["message"] == "Launch cold brew this fall."
        assert data["product"] == "One case per org"
        assert data["title"] == "Fall Cold Brew"
        assert data["location"] == "Bay Area"
        assert data["targetDate"] == target.isoformat()
        assert data["orgCount"] == 8
        assert data["unitsPerOrg"] == 24
        assert data["campaignHashtag"] == "Fall_Brew"
        assert data["notes"] == "Assets link"

        listed = await app_client.get("/api/brands/me/drop-requests", headers=headers)
        assert listed.status_code == 200
        listed_row = listed.json()["data"][0]
        assert listed_row["title"] == "Fall Cold Brew"
        assert listed_row["campaignHashtag"] == "Fall_Brew"
        assert listed_row["orgCount"] == 8
        assert listed_row["unitsPerOrg"] == 24

    async def test_legacy_ticket_structured_fields_are_null(
        self, app_client: AsyncClient, db_session
    ):
        _, brand, headers = await _brand_ctx(db_session)
        await make_drop_request(db_session, brand, message="Old ticket", notes="n")
        res = await app_client.get("/api/brands/me/drop-requests", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()["data"][0]
        assert data["message"] == "Old ticket"
        assert data["notes"] == "n"
        assert data["product"] is None
        assert data["title"] is None
        assert data["location"] is None
        assert data["targetDate"] is None
        assert data["orgCount"] is None
        assert data["unitsPerOrg"] is None
        assert data["campaignHashtag"] is None

    @pytest.mark.parametrize(
        "overrides",
        [
            {"message": "   "},
            {"product": ""},
            {"message": "x" * 4001},
            {"product": "y" * 1001},
            {"title": "t" * 121},
            {"location": "L" * 256},
            {"notes": "n" * 4001},
            {"orgCount": 0},
            {"orgCount": 201},
            {"unitsPerOrg": 0},
            {"unitsPerOrg": 10001},
            {"campaignHashtag": "bad tag"},
            {"campaignHashtag": "bad-tag"},
            {"campaignHashtag": "a" * 101},
            {"campaignHashtag": "#"},
            {"notAField": "nope"},
        ],
    )
    async def test_rejects_invalid_create(
        self, app_client: AsyncClient, db_session, overrides: dict
    ):
        _, _, headers = await _brand_ctx(db_session)
        res = await app_client.post(
            "/api/brands/me/drop-requests",
            json=_ticket_body(**overrides),
            headers=headers,
        )
        assert res.status_code == 422, res.text
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"

    async def test_rejects_missing_product(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        res = await app_client.post(
            "/api/brands/me/drop-requests",
            json={"message": "Need product"},
            headers=headers,
        )
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"

    async def test_target_date_window(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        today = datetime.now(timezone.utc).date()
        for offset, ok in (
            (0, True),
            (365, True),
            (-1, False),
            (366, False),
        ):
            target = today + timedelta(days=offset)
            res = await app_client.post(
                "/api/brands/me/drop-requests",
                json=_ticket_body(
                    message=f"Date {offset}",
                    targetDate=target.isoformat(),
                ),
                headers=headers,
            )
            if ok:
                assert res.status_code == 200, res.text
                assert res.json()["data"]["targetDate"] == target.isoformat()
            else:
                assert res.status_code == 422, res.text

    async def test_boundary_lengths_and_counts_accepted(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        today = datetime.now(timezone.utc).date().isoformat()
        res = await app_client.post(
            "/api/brands/me/drop-requests",
            json=_ticket_body(
                message="m" * 4000,
                product="p" * 1000,
                title="t" * 120,
                location="L" * 255,
                notes="n" * 4000,
                orgCount=200,
                unitsPerOrg=10000,
                campaignHashtag="#AbC_12",
                targetDate=today,
            ),
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert len(data["message"]) == 4000
        assert len(data["product"]) == 1000
        assert len(data["title"]) == 120
        assert len(data["location"]) == 255
        assert len(data["notes"]) == 4000
        assert data["orgCount"] == 200
        assert data["unitsPerOrg"] == 10000
        assert data["campaignHashtag"] == "AbC_12"
        assert data["targetDate"] == today

        minimums = await app_client.post(
            "/api/brands/me/drop-requests",
            json=_ticket_body(message="mins", orgCount=1, unitsPerOrg=1),
            headers=headers,
        )
        assert minimums.status_code == 200, minimums.text
        assert minimums.json()["data"]["orgCount"] == 1
        assert minimums.json()["data"]["unitsPerOrg"] == 1


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
        org.delivery_address = "2301 Bancroft Way, Berkeley, CA 94720"
        await db_session.flush()
        await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)

        res = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["title"] == drop.title
        assert data["publishedAt"] is not None
        assert len(data["applications"]) == 1
        app = data["applications"][0]
        assert app["orgName"] == org.org_name
        assert app["deliveryAddress"] == "2301 Bancroft Way, Berkeley, CA 94720"
        assert "attributedPostCount" in app
        assert "attributedLikes" in app
        assert "attributedEngagement" in app
        assert "totalEngagement" in data
        assert "totalReach" in data
        assert "totalPosts" in data

    async def test_linked_posts_include_stored_insights(self, app_client: AsyncClient, db_session):
        """Brand drop posts carry the insight columns the org list already returns."""
        _, brand, headers = await _brand_ctx(db_session)
        drop = await make_drop(db_session, brand)
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, org_user)
        app = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)

        feed = await make_social_post(
            db_session, org, caption="feed post", media_product_type=SocialMediaProductType.FEED
        )
        feed.reach = 1200
        feed.views = 3400
        feed.saved = 15
        feed.shares = 4
        feed.total_interactions = 80
        feed.profile_visits = 9
        feed.profile_activity = 3
        feed.follows = 2
        reel = await make_social_post(
            db_session,
            org,
            caption="reel post",
            media_product_type=SocialMediaProductType.REELS,
        )
        reel.reach = 500
        reel.views = None
        reel.saved = 0
        reel.shares = 1
        reel.total_interactions = 6
        reel.ig_reels_avg_watch_time = 1200
        reel.ig_reels_video_view_total_time = 48000
        reel.reels_skip_rate = 62.8
        await db_session.flush()
        await make_post_link(db_session, feed, app)
        await make_post_link(db_session, reel, app)

        res = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=headers)
        assert res.status_code == 200
        posts = {p["caption"]: p for p in res.json()["data"]["applications"][0]["posts"]}
        assert posts["feed post"]["platform"] == "instagram"
        assert posts["feed post"]["reach"] == 1200
        assert posts["feed post"]["views"] == 3400
        assert posts["feed post"]["saved"] == 15
        assert posts["feed post"]["shares"] == 4
        assert posts["feed post"]["totalInteractions"] == 80
        assert posts["feed post"]["profileVisits"] == 9
        assert posts["feed post"]["profileActivity"] == 3
        assert posts["feed post"]["follows"] == 2
        assert posts["feed post"]["igReelsAvgWatchTime"] is None
        assert posts["reel post"]["views"] is None
        assert posts["reel post"]["saved"] == 0
        assert posts["reel post"]["igReelsAvgWatchTime"] == 1200
        assert posts["reel post"]["igReelsVideoViewTotalTime"] == 48000
        assert posts["reel post"]["reelsSkipRate"] == pytest.approx(62.8)
        assert posts["reel post"]["profileVisits"] is None
        assert posts["reel post"]["follows"] is None

    async def test_delivery_address_null_unless_applied_or_accepted(
        self, app_client: AsyncClient, db_session
    ):
        """Brand drop detail exposes ship-to only for applied/accepted rows."""
        _, brand, headers = await _brand_ctx(db_session)
        drop = await make_drop(db_session, brand)
        address = "2301 Bancroft Way, Berkeley, CA 94720"
        for decision in (
            ApplicationDecision.APPLIED,
            ApplicationDecision.ACCEPTED,
            ApplicationDecision.DENIED,
        ):
            org_user = await persist(db_session, _org_user(handle=f"addr_{decision.value}"))
            org = await make_org(db_session, org_user)
            org.delivery_address = address
            await db_session.flush()
            await make_application(db_session, drop, org, decision=decision)

        res = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=headers)
        assert res.status_code == 200
        by_decision = {a["decision"]: a for a in res.json()["data"]["applications"]}
        assert by_decision["applied"]["deliveryAddress"] == address
        assert by_decision["accepted"]["deliveryAddress"] == address
        assert by_decision["denied"]["deliveryAddress"] is None

    async def test_attributed_totals_scoped_per_application(
        self, app_client: AsyncClient, db_session
    ):
        """Deny+reapply leaves two rows; each must only count its own linked posts."""
        _, brand, headers = await _brand_ctx(db_session)
        drop = await make_drop(db_session, brand)
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, org_user)

        denied = await make_application(db_session, drop, org, decision=ApplicationDecision.DENIED)
        reapplied = await make_application(
            db_session, drop, org, decision=ApplicationDecision.APPLIED
        )
        old_post = await make_social_post(db_session, org, likes=40, comments=4)
        new_post = await make_social_post(db_session, org, likes=10, comments=1)
        await make_post_link(db_session, old_post, denied)
        await make_post_link(db_session, new_post, reapplied)

        res = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=headers)
        assert res.status_code == 200
        by_decision = {a["decision"]: a for a in res.json()["data"]["applications"]}
        assert by_decision["denied"]["attributedPostCount"] == 1
        assert by_decision["denied"]["attributedLikes"] == 40
        assert by_decision["denied"]["attributedEngagement"] == 44
        assert by_decision["applied"]["attributedPostCount"] == 1
        assert by_decision["applied"]["attributedLikes"] == 10
        assert by_decision["applied"]["attributedEngagement"] == 11

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
        for i, name in enumerate(["Org A", "Org B", "Org C"]):
            org_user = await persist(db_session, _org_user(handle=f"finalize_{i}"))
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
        # A live drop must not finalize (request_received auto-advances when closed).
        brand_user = await persist(db_session, make_user(role=PortalRole.BRAND))
        brand = await make_brand(db_session, brand_name="Stage Brand")
        brand.user_id = brand_user.id
        await db_session.flush()
        drop = await make_drop(
            db_session,
            brand,
            stage=BrandTrackerStage.DROP_ACTIVE,
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
        org_user = await persist(db_session, _org_user(handle="finalize_d"))
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

    async def test_hidden_drop_404s_until_unhide(self, app_client: AsyncClient, db_session):
        _, drop, orgs, headers = await self._setup_finalize(db_session)
        drop.hidden_at = datetime.now(timezone.utc)
        await db_session.flush()

        payload = {"allocations": [{"orgId": str(orgs[0].id), "units": 0}]}
        hidden = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json=payload,
            headers=headers,
        )
        assert hidden.status_code == 404
        await db_session.refresh(drop)
        assert drop.applicant_selection_finalized_at is None

        drop.hidden_at = None
        await db_session.flush()
        shown = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json=payload,
            headers=headers,
        )
        assert shown.status_code == 200
        await db_session.refresh(drop)
        assert drop.applicant_selection_finalized_at is not None

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

    async def test_finalize_auto_advances_from_request_received(
        self, app_client: AsyncClient, db_session
    ):
        """When autoclose missed, brand finalize can enter the selection stage."""
        user = await persist(db_session, make_user(role=PortalRole.BRAND))
        brand = await make_brand(db_session, brand_name="Stuck Brand")
        brand.user_id = user.id
        await db_session.flush()
        headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        drop = await make_drop(
            db_session,
            brand,
            stage=BrandTrackerStage.REQUEST_RECEIVED,
            capacity_total=2,
            apply_open_at=datetime.now(timezone.utc) - timedelta(days=10),
            apply_close_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, org_user)
        await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)

        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={"allocations": [{"orgId": str(org.id), "units": 0}]},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        await db_session.refresh(drop)
        assert drop.brand_tracker_stage == BrandTrackerStage.FINALIZING_AGREEMENTS.value
        assert drop.applicant_selection_finalized_at is not None

    async def test_finalize_manual_reopen_blocks_auto_advance(
        self, app_client: AsyncClient, db_session
    ):
        user = await persist(db_session, make_user(role=PortalRole.BRAND))
        brand = await make_brand(db_session, brand_name="Reopen Brand")
        brand.user_id = user.id
        await db_session.flush()
        headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        drop = await make_drop(
            db_session,
            brand,
            stage=BrandTrackerStage.REQUEST_RECEIVED,
            capacity_total=2,
            apply_open_at=datetime.now(timezone.utc) - timedelta(days=10),
            apply_close_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        drop.manual_reopen = True
        await db_session.flush()
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, org_user)
        await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)

        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={"allocations": [{"orgId": str(org.id), "units": 0}]},
            headers=headers,
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "DROP_NOT_IN_SELECTION_STAGE"
        await db_session.refresh(drop)
        assert drop.brand_tracker_stage == BrandTrackerStage.REQUEST_RECEIVED.value

    async def test_org_not_applied(self, app_client: AsyncClient, db_session):
        _, drop, orgs, headers = await self._setup_finalize(db_session)
        # Create an org that hasn't applied
        org_user = await persist(db_session, _org_user(handle="finalize_no_app"))
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

    async def test_reopen_round_exceeds_remaining_capacity(
        self, app_client: AsyncClient, db_session
    ):
        """Prior accepted seats consume capacity; second round cannot overfill."""
        user = await persist(db_session, make_user(role=PortalRole.BRAND))
        brand = await make_brand(db_session, brand_name="Reopen Cap Brand")
        brand.user_id = user.id
        await db_session.flush()
        headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        drop = await make_drop(
            db_session,
            brand,
            capacity_total=2,
            stage=BrandTrackerStage.FINALIZING_AGREEMENTS,
            apply_open_at=datetime.now(timezone.utc) - timedelta(days=30),
            apply_close_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        # One seat already taken from a prior finalize round.
        prior_user = await persist(db_session, _org_user(handle="reopen_prior"))
        prior_org = await make_org(db_session, prior_user, org_name="Prior Accept")
        await make_application(db_session, drop, prior_org, decision=ApplicationDecision.ACCEPTED)
        # Two new applied orgs — accepting both would exceed remaining capacity (1).
        new_orgs = []
        for i, name in enumerate(["New A", "New B"]):
            ou = await persist(db_session, _org_user(handle=f"reopen_new_{i}"))
            org = await make_org(db_session, ou, org_name=name)
            await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)
            new_orgs.append(org)

        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={
                "allocations": [
                    {"orgId": str(new_orgs[0].id), "units": 0},
                    {"orgId": str(new_orgs[1].id), "units": 0},
                ]
            },
            headers=headers,
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "CAPACITY_EXCEEDED"

    async def test_reopen_round_exceeds_remaining_units(self, app_client: AsyncClient, db_session):
        user = await persist(db_session, make_user(role=PortalRole.BRAND))
        brand = await make_brand(db_session, brand_name="Reopen Units Brand")
        brand.user_id = user.id
        await db_session.flush()
        headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        drop = await make_drop(
            db_session,
            brand,
            capacity_total=5,
            stage=BrandTrackerStage.FINALIZING_AGREEMENTS,
            total_product_units=100,
            apply_open_at=datetime.now(timezone.utc) - timedelta(days=30),
            apply_close_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        prior_user = await persist(db_session, _org_user(handle="reopen_units_prior"))
        prior_org = await make_org(db_session, prior_user, org_name="Prior Units")
        prior_app = await make_application(
            db_session, drop, prior_org, decision=ApplicationDecision.ACCEPTED
        )
        prior_app.allocated_units = 70
        await db_session.flush()

        ou = await persist(db_session, _org_user(handle="reopen_units_new"))
        org = await make_org(db_session, ou, org_name="New Units")
        await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)

        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={"allocations": [{"orgId": str(org.id), "units": 40}]},
            headers=headers,
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "UNIT_BUDGET_EXCEEDED"

    async def test_reopen_round_fills_remaining_capacity(self, app_client: AsyncClient, db_session):
        user = await persist(db_session, make_user(role=PortalRole.BRAND))
        brand = await make_brand(db_session, brand_name="Reopen Fill Brand")
        brand.user_id = user.id
        await db_session.flush()
        headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        drop = await make_drop(
            db_session,
            brand,
            capacity_total=2,
            stage=BrandTrackerStage.FINALIZING_AGREEMENTS,
            apply_open_at=datetime.now(timezone.utc) - timedelta(days=30),
            apply_close_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        prior_user = await persist(db_session, _org_user(handle="reopen_fill_prior"))
        prior_org = await make_org(db_session, prior_user, org_name="Prior Seat")
        await make_application(db_session, drop, prior_org, decision=ApplicationDecision.ACCEPTED)
        ou = await persist(db_session, _org_user(handle="reopen_fill_new"))
        org = await make_org(db_session, ou, org_name="Fill Seat")
        await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)
        denied_ou = await persist(db_session, _org_user(handle="reopen_fill_denied"))
        denied_org = await make_org(db_session, denied_ou, org_name="Denied Seat")
        await make_application(db_session, drop, denied_org, decision=ApplicationDecision.APPLIED)

        res = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/finalize-applicants",
            json={"allocations": [{"orgId": str(org.id), "units": 0}]},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["acceptedCount"] == 1
        assert data["deniedCount"] == 1
        await db_session.refresh(drop)
        assert drop.applicant_selection_finalized_at is not None
        accepted = list(
            await db_session.scalars(
                select(DropApplication).where(
                    DropApplication.drop_id == drop.id,
                    DropApplication.decision == ApplicationDecision.ACCEPTED.value,
                )
            )
        )
        assert len(accepted) == 2


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

    async def test_buckets_by_posted_at_not_sync_stamp(self, app_client: AsyncClient, db_session):
        """Two posts with distinct posted_at and identical metrics_updated_at.

        Series must rise across buckets (posted_at axis), not cliff into the last
        bucket the way a shared sync stamp would.
        """
        from datetime import datetime, timedelta, timezone

        from app.models.social_post import SocialPost
        from tests.conftest import make_post_link

        _, brand, headers = await _brand_ctx(db_session)
        drop = await make_drop(db_session, brand)
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, org_user)
        app = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)

        now = datetime.now(timezone.utc)
        sync_stamp = now
        older = SocialPost(
            org_id=org.id,
            platform="instagram",
            external_id="eng_old",
            url="https://instagram.test/p/old",
            caption="old",
            media_type="IMAGE",
            media_product_type="FEED",
            posted_at=now - timedelta(days=10),
            likes=5,
            comments=0,
            metrics_updated_at=sync_stamp,
        )
        newer = SocialPost(
            org_id=org.id,
            platform="instagram",
            external_id="eng_new",
            url="https://instagram.test/p/new",
            caption="new",
            media_type="IMAGE",
            media_product_type="FEED",
            posted_at=now - timedelta(days=1),
            likes=7,
            comments=0,
            metrics_updated_at=sync_stamp,
        )
        db_session.add_all([older, newer])
        await db_session.flush()
        await make_post_link(db_session, older, app)
        await make_post_link(db_session, newer, app)

        res = await app_client.get("/api/brands/me/engagement-series", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        engagements = [p["engagement"] for p in data]
        assert engagements[-1] == 12
        # At least one earlier bucket is strictly below the final total
        # (not a single-cliff of 0…0,12).
        assert any(e < 12 for e in engagements[:-1])
        assert any(e > 0 for e in engagements[:-1])
