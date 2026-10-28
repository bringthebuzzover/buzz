"""Admin org erase removes identity and campaign participation (PRODUCT §3.1.2)."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

from httpx import AsyncClient
from sqlalchemy import func, select

from app.config import settings
from app.jobs.metric_sync import _eligible_orgs
from app.models.application import DropApplication
from app.models.enums import (
    ApplicationDecision,
    BrandTrackerStage,
    OrgCategory,
    OrgUserStatus,
    PortalRole,
)
from app.models.notify_me import NotifyMe
from app.models.organization import Organization
from app.models.post_link import PostCampaignLink
from app.models.shipment import DropApplicationShipment
from app.models.social_post import SocialPost
from app.models.user import User
from app.security import jwt
from app.services.erased_org_participation import withdraw_org_campaign_participation
from tests.conftest import (
    make_application,
    make_brand,
    make_drop,
    make_notify,
    make_org,
    make_post_link,
    make_social_post,
    make_suggestion,
    make_user,
    mint_access_token,
    persist,
    set_request_cookies,
)


async def _admin_headers(db_session) -> dict:
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


async def _seed_erasable_org(db_session, *, with_email: bool = True):
    user = await persist(db_session, make_user(role=PortalRole.ORG))
    user.instagram_username = "CampusGreeks"
    user.edu_email = "greeks@school.edu" if with_email else None
    user.instagram_access_token = "enc-tok"
    user.instagram_user_id = "ig-123"
    user.instagram_token_user_id = "ig-123"
    user.token_version = 1
    org = await make_org(db_session, user, org_name="Campus Greeks")
    org.follower_count = 1500
    org.university = "State U"
    org.delivery_address = "1 Main St"
    org.shipping_line1 = "1 Main St"
    org.shipping_city = "Ithaca"
    org.shipping_state = "NY"
    org.shipping_postal_code = "14850"
    org.contact_name = "Alex"
    org.member_count = 40
    org.category = OrgCategory.FRATERNITY.value
    await db_session.flush()
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_ACTIVE)
    accepted = await make_application(
        db_session,
        drop,
        org,
        decision=ApplicationDecision.ACCEPTED,
        pitch="We love it",
    )
    applied = await make_application(
        db_session,
        await make_drop(db_session, brand, title="Other"),
        org,
        decision=ApplicationDecision.APPLIED,
        pitch="Still applied",
    )
    post = await make_social_post(db_session, org, likes=12, comments=3)
    await make_post_link(db_session, post, accepted)
    await make_notify(db_session, org, drop)
    return user, org, accepted, applied, post


class TestAdminOrgErase:
    async def test_erase_scrubs_identity_and_drops_participation(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        send = AsyncMock(return_value=True)
        monkeypatch.setattr("app.services.admin_erase.send_org_erased_email", send)
        user, org, accepted, applied, post = await _seed_erasable_org(db_session)
        headers = await _admin_headers(db_session)

        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "@CampusGreeks"},
        )
        assert res.status_code == 200
        body = res.json()["data"]
        assert body["status"] == "erased"
        assert body["emailSent"] is True
        assert body["emailToDomain"] == "school.edu"
        send.assert_awaited_once()

        await db_session.refresh(user)
        await db_session.refresh(org)

        assert user.status == OrgUserStatus.ERASED.value
        assert user.instagram_username is None
        assert user.instagram_user_id is None
        assert user.edu_email is None
        assert user.pending_edu_email is None
        assert user.instagram_access_token is None
        assert user.token_version == 2
        assert org.org_name == "Deleted organization"
        assert org.claimed_instagram_username is None
        assert org.ig_bind_mismatched_at is None
        assert org.ig_bind_graph_username is None
        assert org.ig_bind_mismatch_acked_at is None
        assert org.follower_count is None
        assert org.university == "State U"
        assert org.delivery_address is None
        assert org.shipping_line1 is None
        assert org.shipping_city is None
        assert org.shipping_state is None
        assert org.shipping_postal_code is None
        assert org.contact_name is None
        app_count = await db_session.scalar(
            select(func.count())
            .select_from(DropApplication)
            .where(DropApplication.org_id == org.id)
        )
        assert app_count == 0
        post_count = await db_session.scalar(
            select(func.count()).select_from(SocialPost).where(SocialPost.org_id == org.id)
        )
        assert post_count == 0
        link_count = await db_session.scalar(
            select(func.count())
            .select_from(PostCampaignLink)
            .where(PostCampaignLink.post_id == post.id)
        )
        assert link_count == 0
        notify_count = await db_session.scalar(
            select(func.count()).select_from(NotifyMe).where(NotifyMe.org_id == org.id)
        )
        assert notify_count == 0

    async def test_erase_commits_the_bump(self, db_session, monkeypatch):
        from app.services.admin_erase import erase_org_user

        send = AsyncMock(return_value=True)
        monkeypatch.setattr("app.services.admin_erase.send_org_erased_email", send)
        user, *_ = await _seed_erasable_org(db_session)
        commits: list[int] = []
        original = db_session.commit

        async def spy() -> None:
            commits.append(1)
            await original()

        monkeypatch.setattr(db_session, "commit", spy)
        await erase_org_user(db_session, user.id, "@CampusGreeks")
        assert commits, "erase_org_user must commit the token_version bump itself"

    async def test_erase_clears_pending_edu_email(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        """Pending-swap latch must not survive erase (org.edu-email-change)."""
        send = AsyncMock(return_value=True)
        monkeypatch.setattr("app.services.admin_erase.send_org_erased_email", send)
        user, _org, *_rest = await _seed_erasable_org(db_session)
        user.pending_edu_email = "new-officer@school.edu"
        await db_session.flush()
        headers = await _admin_headers(db_session)

        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "@CampusGreeks"},
        )
        assert res.status_code == 200, res.text
        await db_session.refresh(user)
        assert user.edu_email is None
        assert user.pending_edu_email is None
        assert user.status == OrgUserStatus.ERASED.value

    async def test_confirm_mismatch_and_email_rejected(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        send = AsyncMock(return_value=True)
        monkeypatch.setattr("app.services.admin_erase.send_org_erased_email", send)
        user, *_ = await _seed_erasable_org(db_session)
        headers = await _admin_headers(db_session)

        bad = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "wronghandle"},
        )
        assert bad.status_code == 400
        email_as_confirm = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "greeks@school.edu"},
        )
        assert email_as_confirm.status_code == 400
        await db_session.refresh(user)
        assert user.status == OrgUserStatus.ACTIVE.value
        send.assert_not_called()

    async def test_missing_handle_refuses(self, app_client: AsyncClient, db_session, monkeypatch):
        send = AsyncMock(return_value=True)
        monkeypatch.setattr("app.services.admin_erase.send_org_erased_email", send)
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        user.instagram_username = None
        await make_org(db_session, user)
        headers = await _admin_headers(db_session)
        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "anything"},
        )
        assert res.status_code == 400
        send.assert_not_called()

    async def test_idempotent_no_second_email(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        send = AsyncMock(return_value=True)
        monkeypatch.setattr("app.services.admin_erase.send_org_erased_email", send)
        user, *_ = await _seed_erasable_org(db_session)
        headers = await _admin_headers(db_session)
        first = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "campusgreeks"},
        )
        assert first.status_code == 200
        assert first.json()["data"]["emailSent"] is True
        second = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "campusgreeks"},
        )
        assert second.status_code == 200
        assert second.json()["data"]["emailSent"] is False
        assert send.await_count == 1

    async def test_no_email_on_file(self, app_client: AsyncClient, db_session, monkeypatch):
        send = AsyncMock(return_value=True)
        monkeypatch.setattr("app.services.admin_erase.send_org_erased_email", send)
        user, *_ = await _seed_erasable_org(db_session, with_email=False)
        headers = await _admin_headers(db_session)
        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "CampusGreeks"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["emailSent"] is False
        send.assert_not_called()

    async def test_email_helper_false_keeps_erase(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        send = AsyncMock(return_value=False)
        monkeypatch.setattr("app.services.admin_erase.send_org_erased_email", send)
        user, *_ = await _seed_erasable_org(db_session)
        headers = await _admin_headers(db_session)
        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "CampusGreeks"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["emailSent"] is False
        await db_session.refresh(user)
        assert user.status == OrgUserStatus.ERASED.value

    async def test_list_default_excludes_erased(self, app_client: AsyncClient, db_session):
        active = await persist(db_session, make_user(role=PortalRole.ORG))
        active.instagram_username = "alive"
        await make_org(db_session, active, org_name="Alive")
        erased = await persist(
            db_session, make_user(role=PortalRole.ORG, status=OrgUserStatus.ERASED)
        )
        erased.instagram_username = None
        await make_org(db_session, erased, org_name="Deleted organization")
        headers = await _admin_headers(db_session)

        all_res = await app_client.get("/api/admin/orgs", headers=headers)
        ids = {row["userId"] for row in all_res.json()["data"]}
        assert str(active.id) in ids
        assert str(erased.id) not in ids

        erased_res = await app_client.get("/api/admin/orgs?status=erased", headers=headers)
        erased_ids = {row["userId"] for row in erased_res.json()["data"]}
        assert str(erased.id) in erased_ids
        assert str(active.id) not in erased_ids

    async def test_clear_ig_refuses_erased(self, app_client: AsyncClient, db_session):
        user = await persist(
            db_session, make_user(role=PortalRole.ORG, status=OrgUserStatus.ERASED)
        )
        headers = await _admin_headers(db_session)
        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/clear-instagram-token", headers=headers
        )
        assert res.status_code == 409

    async def test_erased_org_excluded_from_participants_and_totals(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        """Deleted org is absent from drop participants, drop totals, and dashboard."""

        monkeypatch.setattr(
            "app.services.admin_erase.send_org_erased_email",
            AsyncMock(return_value=True),
        )
        erased_user = await persist(db_session, make_user(role=PortalRole.ORG))
        erased_user.instagram_username = "GhostOrg"
        erased_user.edu_email = "ghost@school.edu"
        ghost = await make_org(db_session, erased_user, org_name="Ghost Greeks")
        ghost.university = "Ghost Campus"
        ghost.follower_count = 9000

        live_user = await persist(db_session, make_user(role=PortalRole.ORG))
        live_user.instagram_username = "LiveOrg"
        live = await make_org(db_session, live_user, org_name="Live Club")
        live.university = "Live Campus"
        live.follower_count = 100

        brand = await make_brand(db_session)
        drop = await make_drop(
            db_session,
            brand,
            stage=BrandTrackerStage.DROP_ACTIVE,
            total_product_units=20,
        )
        ghost_app = await make_application(
            db_session, drop, ghost, decision=ApplicationDecision.ACCEPTED
        )
        ghost_app.allocated_units = 7
        live_app = await make_application(
            db_session, drop, live, decision=ApplicationDecision.ACCEPTED
        )
        live_app.allocated_units = 3
        ghost_post = await make_social_post(db_session, ghost, likes=400, comments=23, reach=2039)
        live_post = await make_social_post(db_session, live, likes=8, comments=2, reach=100)
        await make_post_link(db_session, ghost_post, ghost_app)
        await make_post_link(db_session, live_post, live_app)
        await make_suggestion(db_session, ghost_post, ghost_app)
        db_session.add(
            DropApplicationShipment(
                application_id=ghost_app.id,
                tracking_number="1Z999",
                carrier="ups",
            )
        )
        await db_session.flush()
        drop_id = drop.id
        ghost_id = ghost.id
        live_id = live.id

        headers = await _admin_headers(db_session)
        erased = await app_client.post(
            f"/api/admin/orgs/{erased_user.id}/erase",
            headers=headers,
            json={"confirm": "@GhostOrg"},
        )
        assert erased.status_code == 200, erased.text

        admin_drop = await app_client.get(f"/api/admin/drops/{drop_id}", headers=headers)
        assert admin_drop.status_code == 200, admin_drop.text
        admin_body = admin_drop.json()["data"]
        admin_orgs = {row["orgId"] for row in admin_body["applicants"]}
        assert str(ghost_id) not in admin_orgs
        assert str(live_id) in admin_orgs
        assert admin_body["linkedPostCount"] == 1
        assert admin_body["allocatedUnits"] == 3

        admin_brand = await app_client.get(f"/api/admin/brands/{brand.id}", headers=headers)
        assert admin_brand.status_code == 200, admin_brand.text
        brand_drops = admin_brand.json()["data"]["drops"]
        listed = next(row for row in brand_drops if row["id"] == str(drop_id))
        assert listed["acceptedCount"] == 1

        brand_owner = await db_session.get(User, brand.user_id)
        assert brand_owner is not None
        brand_headers = {"Authorization": f"Bearer {mint_access_token(brand_owner)}"}

        brand_drop = await app_client.get(f"/api/brands/me/drops/{drop_id}", headers=brand_headers)
        assert brand_drop.status_code == 200, brand_drop.text
        detail = brand_drop.json()["data"]
        detail_orgs = {row["orgId"] for row in detail["applications"]}
        assert str(ghost_id) not in detail_orgs
        assert str(live_id) in detail_orgs
        assert detail["totalPosts"] == 1
        assert detail["totalEngagement"] == 10
        assert detail["totalReach"] == 100
        assert all(row["accountErased"] is False for row in detail["applications"])

        campaign_list = await app_client.get("/api/brands/me/drops", headers=brand_headers)
        assert campaign_list.status_code == 200, campaign_list.text
        campaign = next(row for row in campaign_list.json()["data"] if row["id"] == str(drop_id))
        assert campaign["totalEngagement"] == 10
        assert campaign["totalReach"] == 100
        assert campaign["totalPosts"] == 1

        dashboard = await app_client.get("/api/brands/me/aggregate", headers=brand_headers)
        assert dashboard.status_code == 200, dashboard.text
        agg = dashboard.json()["data"]
        assert agg["totalEngagement"] == 10
        assert agg["totalReach"] == 100
        assert agg["totalPosts"] == 1
        assert agg["totalOrgs"] == 1
        assert agg["totalCampuses"] == 1

        series = await app_client.get("/api/brands/me/engagement-series", headers=brand_headers)
        assert series.status_code == 200, series.text
        points = series.json()["data"]
        assert points
        assert max(point["engagement"] for point in points) == 10

        assert (
            await db_session.scalar(
                select(func.count()).select_from(SocialPost).where(SocialPost.org_id == ghost_id)
            )
            == 0
        )
        assert (
            await db_session.scalar(
                select(func.count())
                .select_from(DropApplicationShipment)
                .where(DropApplicationShipment.application_id == ghost_app.id)
            )
            == 0
        )
        assert (
            await db_session.scalar(
                select(func.count()).select_from(SocialPost).where(SocialPost.id == live_post.id)
            )
            == 1
        )

    async def test_orphan_erased_participation_cleanup_is_idempotent(self, db_session):
        """Rows left by the old keep-KPI erase are removed, and a second run is a no-op."""

        erased_user = await persist(
            db_session, make_user(role=PortalRole.ORG, status=OrgUserStatus.ERASED)
        )
        erased_user.instagram_username = None
        ghost = await make_org(db_session, erased_user, org_name="Deleted organization")
        ghost.university = "Ghost Campus"
        ghost.follower_count = 1500

        live_user = await persist(db_session, make_user(role=PortalRole.ORG))
        live_user.instagram_username = "StillHere"
        live = await make_org(db_session, live_user, org_name="Still Here")
        live.follower_count = 40

        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_ACTIVE)
        ghost_app = await make_application(
            db_session, drop, ghost, decision=ApplicationDecision.ACCEPTED
        )
        live_app = await make_application(
            db_session, drop, live, decision=ApplicationDecision.ACCEPTED
        )
        ghost_post = await make_social_post(db_session, ghost, likes=400, comments=23, reach=2039)
        live_post = await make_social_post(db_session, live, likes=5, comments=1, reach=20)
        await make_post_link(db_session, ghost_post, ghost_app)
        await make_post_link(db_session, live_post, live_app)
        await db_session.flush()

        await withdraw_org_campaign_participation(db_session)
        await withdraw_org_campaign_participation(db_session)

        assert (
            await db_session.scalar(
                select(func.count())
                .select_from(DropApplication)
                .where(DropApplication.org_id == ghost.id)
            )
            == 0
        )
        assert (
            await db_session.scalar(
                select(func.count()).select_from(SocialPost).where(SocialPost.org_id == ghost.id)
            )
            == 0
        )
        assert (
            await db_session.scalar(
                select(func.count())
                .select_from(PostCampaignLink)
                .where(PostCampaignLink.post_id == live_post.id)
            )
            == 1
        )
        await db_session.refresh(ghost)
        await db_session.refresh(live)
        assert ghost.follower_count is None
        assert live.follower_count == 40
        assert await db_session.get(Organization, ghost.id) is not None

    async def test_metric_sync_skips_erased(self, db_session):
        user, org, *_ = await _seed_erasable_org(db_session)
        user.status = OrgUserStatus.ERASED.value
        await db_session.flush()
        eligible = await _eligible_orgs(db_session, datetime.now(timezone.utc))
        assert org.id not in {o.id for o in eligible}


class TestEraseRefreshGate:
    async def test_refresh_refuses_erased(self, app_client: AsyncClient, db_session):
        user = await persist(
            db_session, make_user(role=PortalRole.ORG, status=OrgUserStatus.ERASED)
        )
        refresh = jwt.create_refresh_token(user.id, token_version=user.token_version or 0)
        set_request_cookies(app_client, {settings.REFRESH_COOKIE_NAME: refresh})
        res = await app_client.post("/api/auth/refresh")
        assert res.status_code == 401
