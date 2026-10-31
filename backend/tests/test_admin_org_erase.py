"""Admin org erase freezes campaign metrics and strips Instagram identifiers."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, text

from app.config import settings
from app.exceptions import BuzzAPIException
from app.jobs.autolink_scan import scan_autolink
from app.jobs.metric_sync import _eligible_orgs, sync_metrics_for_orgs
from app.models.admin_audit_event import AdminAuditEvent
from app.models.application import DropApplication
from app.models.drop_apply_intent import DropApplyIntent
from app.models.enums import (
    ApplicationDecision,
    DropApplyIntentStatus,
    OrgCategory,
    OrgUserStatus,
    PortalRole,
)
from app.models.notify_me import NotifyMe
from app.models.org_apply_prefill import OrgApplyPrefill
from app.models.org_connect_token import OrgConnectToken
from app.models.org_ig_change_request import OrgIgChangeRequest
from app.models.organization import Organization
from app.models.post_link import PostCampaignLink
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.shipment import DropApplicationShipment
from app.models.social_post import SocialPost
from app.models.user import User
from app.security import jwt
from app.services.auth import handle_instagram_callback
from app.services.email import _org_erased_body
from app.services.erased_org_participation import freeze_statements
from app.services.posts import link_post, unlink_post
from tests.conftest import (
    FakeInstagramClient,
    admin_headers,
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
    drop = await make_drop(db_session, brand)
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


async def _seed_identity_leftovers(db_session, user: User, org: Organization) -> None:
    now = datetime.now(timezone.utc)
    db_session.add(
        OrgConnectToken(
            user_id=user.id,
            org_id=org.id,
            token_hash=uuid.uuid4().hex + uuid.uuid4().hex[:32],
            email=user.edu_email or "greeks@school.edu",
            expires_at=now + timedelta(days=7),
        )
    )
    db_session.add(
        OrgIgChangeRequest(
            org_id=org.id,
            user_id=user.id,
            kind="rename",
            current_handle="CampusGreeks",
            requested_handle="OtherGreeks",
            reason="officer change",
        )
    )
    db_session.add(
        OrgApplyPrefill(
            token_hash=uuid.uuid4().hex + uuid.uuid4().hex[:32],
            invite_email="invite@school.edu",
            edu_email=user.edu_email or "greeks@school.edu",
            instagram_handle="campusgreeks",
            expires_at=now + timedelta(days=7),
            used_by_user_id=user.id,
        )
    )


def _draft_prefill(
    invite_email: str,
    *,
    edu_email: str | None,
    instagram_handle: str | None,
    used_by_user_id: uuid.UUID | None,
    now: datetime | None = None,
) -> OrgApplyPrefill:
    stamp = now or datetime.now(timezone.utc)
    return OrgApplyPrefill(
        token_hash=uuid.uuid4().hex + uuid.uuid4().hex[:32],
        invite_email=invite_email,
        edu_email=edu_email,
        instagram_handle=instagram_handle,
        expires_at=stamp + timedelta(days=7),
        used_by_user_id=used_by_user_id,
    )


async def _identity_leftovers(db_session, user_id, org_id) -> tuple[int, int, int]:
    connect = await db_session.scalar(
        select(func.count()).select_from(OrgConnectToken).where(OrgConnectToken.user_id == user_id)
    )
    changes = await db_session.scalar(
        select(func.count())
        .select_from(OrgIgChangeRequest)
        .where(OrgIgChangeRequest.org_id == org_id)
    )
    prefills = await db_session.scalar(
        select(func.count())
        .select_from(OrgApplyPrefill)
        .where(OrgApplyPrefill.used_by_user_id == user_id)
    )
    return int(connect or 0), int(changes or 0), int(prefills or 0)


class TestAdminOrgErase:
    async def test_erase_scrubs_identity_and_freezes_metrics(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        send = AsyncMock(return_value=True)
        monkeypatch.setattr("app.services.admin_erase.send_org_erased_email", send)
        user, org, accepted, applied, post = await _seed_erasable_org(db_session)
        post.media_url = "https://instagram.test/media.jpg"
        post.caption = "hello campus"
        post.insights_raw = {"reach": 1}
        post.views = 9
        post.saved = 2
        post.shares = 1
        post.profile_visits = 4
        post.profile_activity = 2
        post.follows = 3
        post.total_interactions = 9
        post.reposts = 1
        post.ig_reels_avg_watch_time = 1500
        post.ig_reels_video_view_total_time = 9000
        post.reels_skip_rate = 25
        user.instagram_granted_permissions = "instagram_business_basic"
        await _seed_identity_leftovers(db_session, user, org)
        await db_session.flush()
        headers = await admin_headers(db_session)

        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "@CampusGreeks"},
        )
        assert res.status_code == 200
        body = res.json()["data"]
        assert body["status"] == "erased"
        assert body["emailQueued"] is True
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
        assert org.university == ""
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
        assert app_count == 2
        post_count = await db_session.scalar(
            select(func.count()).select_from(SocialPost).where(SocialPost.org_id == org.id)
        )
        assert post_count == 1
        link_count = await db_session.scalar(
            select(func.count())
            .select_from(PostCampaignLink)
            .where(PostCampaignLink.post_id == post.id)
        )
        assert link_count == 1
        notify_count = await db_session.scalar(
            select(func.count()).select_from(NotifyMe).where(NotifyMe.org_id == org.id)
        )
        assert notify_count == 0
        await db_session.refresh(post)
        await db_session.refresh(accepted)
        await db_session.refresh(applied)
        assert post.likes == 12
        assert post.comments == 3
        assert post.views == 9
        assert post.saved == 2
        assert post.shares == 1
        assert post.caption == ""
        assert post.url == ""
        assert post.media_url is None
        assert post.thumbnail_url is None
        assert post.insights_raw is None
        assert post.profile_visits is None
        assert post.profile_activity is None
        assert post.follows is None
        assert post.total_interactions is None
        assert post.reposts is None
        assert post.ig_reels_avg_watch_time is None
        assert post.ig_reels_video_view_total_time is None
        assert post.reels_skip_rate is None
        assert post.likes == 12
        assert post.views == 9
        assert user.instagram_granted_permissions is None
        assert post.external_id == f"frozen-{post.id}"
        assert post.metrics_frozen_at is not None
        assert await _identity_leftovers(db_session, user.id, org.id) == (0, 0, 0)
        assert accepted.pitch is None
        assert applied.decision == ApplicationDecision.DENIED.value
        assert applied.pitch is None

    async def test_erase_prefill_match_skips_nulls_and_other_users(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        """Email and handle deletes are unclaimed drafts only. Null matches nothing."""

        monkeypatch.setattr(
            "app.services.admin_erase.send_org_erased_email",
            AsyncMock(return_value=True),
        )
        user, _org, *_rest = await _seed_erasable_org(db_session)
        other = await persist(db_session, make_user(role=PortalRole.ORG))
        other.instagram_username = "OtherOrg"
        other.edu_email = "other@school.edu"
        now = datetime.now(timezone.utc)

        unclaimed = _draft_prefill(
            user.edu_email or "greeks@school.edu",
            edu_email=user.edu_email,
            instagram_handle="campusgreeks",
            used_by_user_id=None,
            now=now,
        )
        other_owned = _draft_prefill(
            "other@school.edu",
            edu_email=user.edu_email,
            instagram_handle="campusgreeks",
            used_by_user_id=other.id,
            now=now,
        )
        blank = _draft_prefill(
            "blank@school.edu",
            edu_email=None,
            instagram_handle=None,
            used_by_user_id=None,
            now=now,
        )
        db_session.add(unclaimed)
        db_session.add(other_owned)
        db_session.add(blank)
        await db_session.flush()
        headers = await admin_headers(db_session)

        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "@CampusGreeks"},
        )
        assert res.status_code == 200, res.text
        unclaimed_id = unclaimed.id
        other_owned_id = other_owned.id
        blank_id = blank.id
        db_session.expire_all()
        assert await db_session.get(OrgApplyPrefill, unclaimed_id) is None
        assert await db_session.get(OrgApplyPrefill, other_owned_id) is not None
        assert await db_session.get(OrgApplyPrefill, blank_id) is not None

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
        headers = await admin_headers(db_session)

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
        headers = await admin_headers(db_session)

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
        headers = await admin_headers(db_session)
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
        headers = await admin_headers(db_session)
        first = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "campusgreeks"},
        )
        assert first.status_code == 200
        assert first.json()["data"]["emailQueued"] is True
        second = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "campusgreeks"},
        )
        assert second.status_code == 200
        assert second.json()["data"]["emailQueued"] is False
        assert send.await_count == 1

    async def test_no_email_on_file(self, app_client: AsyncClient, db_session, monkeypatch):
        send = AsyncMock(return_value=True)
        monkeypatch.setattr("app.services.admin_erase.send_org_erased_email", send)
        user, *_ = await _seed_erasable_org(db_session, with_email=False)
        headers = await admin_headers(db_session)
        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "CampusGreeks"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["emailQueued"] is False
        send.assert_not_called()

    async def test_email_helper_false_keeps_erase(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        send = AsyncMock(return_value=False)
        monkeypatch.setattr("app.services.admin_erase.send_org_erased_email", send)
        user, *_ = await _seed_erasable_org(db_session)
        headers = await admin_headers(db_session)
        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "CampusGreeks"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["emailQueued"] is True
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
        headers = await admin_headers(db_session)

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
        headers = await admin_headers(db_session)
        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/clear-instagram-token", headers=headers
        )
        assert res.status_code == 409

    async def test_erased_org_excluded_from_participants_and_totals(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        """Erased org stays anonymized, and its last metrics still count."""

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
        ghost_post.views = 11
        ghost_post.saved = 4
        ghost_post.shares = 6
        ghost_post.profile_visits = 15
        ghost_post.follows = 3
        ghost_post.total_interactions = 40
        ghost_post.caption = "ghost caption"
        ghost_post.media_url = "https://instagram.test/ghost.jpg"
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

        headers = await admin_headers(db_session)
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
        assert str(ghost_id) in admin_orgs
        assert str(live_id) in admin_orgs
        ghost_admin = next(row for row in admin_body["applicants"] if row["orgId"] == str(ghost_id))
        assert ghost_admin["accountErased"] is True
        assert ghost_admin["orgName"] == "Deleted organization"
        assert ghost_admin["metricsFrozenAt"] is not None
        assert admin_body["linkedPostCount"] == 2
        assert admin_body["allocatedUnits"] == 10

        admin_brand = await app_client.get(f"/api/admin/brands/{brand.id}", headers=headers)
        assert admin_brand.status_code == 200, admin_brand.text
        brand_drops = admin_brand.json()["data"]["drops"]
        listed = next(row for row in brand_drops if row["id"] == str(drop_id))
        assert listed["acceptedCount"] == 2

        brand_owner = await db_session.get(User, brand.user_id)
        assert brand_owner is not None
        brand_headers = {"Authorization": f"Bearer {mint_access_token(brand_owner)}"}

        brand_drop = await app_client.get(f"/api/brands/me/drops/{drop_id}", headers=brand_headers)
        assert brand_drop.status_code == 200, brand_drop.text
        detail = brand_drop.json()["data"]
        detail_orgs = {row["orgId"] for row in detail["applications"]}
        assert str(ghost_id) in detail_orgs
        assert str(live_id) in detail_orgs
        ghost_row = next(row for row in detail["applications"] if row["orgId"] == str(ghost_id))
        live_row = next(row for row in detail["applications"] if row["orgId"] == str(live_id))
        assert ghost_row["orgName"] == "Deleted organization"
        assert ghost_row["accountErased"] is True
        assert ghost_row["university"] == ""
        assert ghost_row["instagramHandle"] == ""
        assert ghost_row["metricsFrozenAt"] is not None
        assert ghost_row["posts"][0]["caption"] == ""
        assert ghost_row["posts"][0]["url"] == ""
        assert ghost_row["posts"][0]["likes"] == 400
        assert ghost_row["posts"][0]["views"] == 11
        assert ghost_row["posts"][0]["saved"] == 4
        assert ghost_row["posts"][0]["shares"] == 6
        assert ghost_row["posts"][0]["reach"] == 2039
        assert ghost_row["posts"][0]["profileVisits"] is None
        assert ghost_row["posts"][0]["follows"] is None
        assert ghost_row["posts"][0]["totalInteractions"] is None
        assert live_row["accountErased"] is False
        assert live_row["orgName"] == "Live Club"
        assert detail["totalPosts"] == 2
        assert detail["totalEngagement"] == 433
        assert detail["totalReach"] == 2139

        campaign_list = await app_client.get("/api/brands/me/drops", headers=brand_headers)
        assert campaign_list.status_code == 200, campaign_list.text
        campaign = next(row for row in campaign_list.json()["data"] if row["id"] == str(drop_id))
        assert campaign["totalEngagement"] == 433
        assert campaign["totalReach"] == 2139
        assert campaign["totalPosts"] == 2

        dashboard = await app_client.get("/api/brands/me/aggregate", headers=brand_headers)
        assert dashboard.status_code == 200, dashboard.text
        agg = dashboard.json()["data"]
        assert agg["totalEngagement"] == 433
        assert agg["totalReach"] == 2139
        assert agg["totalPosts"] == 2
        assert agg["totalOrgs"] == 2
        assert agg["totalCampuses"] == 1

        series = await app_client.get("/api/brands/me/engagement-series", headers=brand_headers)
        assert series.status_code == 200, series.text
        points = series.json()["data"]
        assert points
        assert max(point["engagement"] for point in points) == 433

        assert (
            await db_session.scalar(
                select(func.count()).select_from(SocialPost).where(SocialPost.org_id == ghost_id)
            )
            == 1
        )
        await db_session.refresh(ghost_post)
        await db_session.refresh(live_post)
        await db_session.refresh(live_user)
        assert ghost_post.external_id == f"frozen-{ghost_post.id}"
        assert ghost_post.likes == 400
        assert ghost_post.profile_visits is None
        assert ghost_post.follows is None
        assert ghost_post.total_interactions is None
        assert "instagram.test" not in ghost_post.url
        assert "instagram.test" in live_post.url
        live_user.instagram_username = "GhostOrg"
        await db_session.flush()
        await db_session.refresh(live_post)
        assert live_post.likes == 8
        assert live_post.external_id != ghost_post.external_id
        assert (
            await db_session.scalar(
                select(func.count())
                .select_from(DropApplicationShipment)
                .where(DropApplicationShipment.application_id == ghost_app.id)
            )
            == 1
        )
        assert (
            await db_session.scalar(
                select(func.count()).select_from(SocialPost).where(SocialPost.id == live_post.id)
            )
            == 1
        )

    async def test_orphan_erased_participation_freeze_is_idempotent(self, db_session):
        """Already-erased rows are stripped in place, and a second run keeps the numbers."""

        erased_user = await persist(
            db_session, make_user(role=PortalRole.ORG, status=OrgUserStatus.ERASED)
        )
        erased_user.instagram_username = None
        erased_user.edu_email = None
        ghost = await make_org(db_session, erased_user, org_name="Deleted organization")
        ghost.university = "Ghost Campus"
        ghost.follower_count = 1500
        ghost.approved_at = datetime.now(timezone.utc)

        live_user = await persist(db_session, make_user(role=PortalRole.ORG))
        live_user.instagram_username = "StillHere"
        live = await make_org(db_session, live_user, org_name="Still Here")
        live.follower_count = 40

        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        ghost_app = await make_application(
            db_session, drop, ghost, decision=ApplicationDecision.ACCEPTED
        )
        live_app = await make_application(
            db_session, drop, live, decision=ApplicationDecision.ACCEPTED
        )
        ghost_post = await make_social_post(db_session, ghost, likes=400, comments=23, reach=2039)
        ghost_post.views = 11
        ghost_post.saved = 4
        ghost_post.shares = 6
        ghost_post.reposts = 2
        ghost_post.reels_skip_rate = 40
        ghost_post.profile_visits = 8
        ghost_post.url = f"erased://post/{ghost_post.id}"
        ghost_post.external_id = f"erased-{ghost_post.id}"
        ghost_post.caption = "[removed]"
        ghost_intent = DropApplyIntent(
            org_id=ghost.id,
            drop_id=drop.id,
            pitch="Ghost chapter will table this",
            status=DropApplyIntentStatus.OPEN.value,
        )
        live_intent = DropApplyIntent(
            org_id=live.id,
            drop_id=drop.id,
            pitch="Live chapter pitch",
            status=DropApplyIntentStatus.OPEN.value,
        )
        db_session.add(ghost_intent)
        db_session.add(live_intent)
        live_post = await make_social_post(db_session, live, likes=5, comments=1, reach=20)
        live_post.profile_visits = 3
        erased_user.instagram_granted_permissions = "instagram_business_basic"
        await make_post_link(db_session, ghost_post, ghost_app)
        await make_post_link(db_session, live_post, live_app)
        now = datetime.now(timezone.utc)
        db_session.add(
            DropApplicationShipment(
                application_id=ghost_app.id,
                tracking_number="1ZKEEP",
                carrier="ups",
            )
        )

        # Migration matches prefills only by used_by_user_id. A null email or
        # handle, or the same string on a live org's draft, must not qualify.
        linked_erased = _draft_prefill(
            "ghost@school.edu",
            edu_email="ghost@school.edu",
            instagram_handle="ghostorg",
            used_by_user_id=erased_user.id,
            now=now,
        )
        unlinked_same_email = _draft_prefill(
            "ghost@school.edu",
            edu_email="ghost@school.edu",
            instagram_handle="ghostorg",
            used_by_user_id=None,
            now=now,
        )
        null_identity = _draft_prefill(
            "blank@school.edu",
            edu_email=None,
            instagram_handle=None,
            used_by_user_id=None,
            now=now,
        )
        live_owned = _draft_prefill(
            "live@school.edu",
            edu_email="live@school.edu",
            instagram_handle="stillhere",
            used_by_user_id=live_user.id,
            now=now,
        )
        db_session.add(linked_erased)
        db_session.add(unlinked_same_email)
        db_session.add(null_identity)
        db_session.add(live_owned)
        db_session.add(
            OrgConnectToken(
                user_id=erased_user.id,
                org_id=ghost.id,
                token_hash=uuid.uuid4().hex + uuid.uuid4().hex[:32],
                email="ghost@school.edu",
                expires_at=now + timedelta(days=7),
            )
        )
        db_session.add(
            OrgConnectToken(
                user_id=live_user.id,
                org_id=live.id,
                token_hash=uuid.uuid4().hex + uuid.uuid4().hex[:32],
                email="live@school.edu",
                expires_at=now + timedelta(days=7),
            )
        )
        await db_session.flush()

        for _ in range(2):
            for statement in freeze_statements():
                await db_session.execute(text(statement))

        assert (
            await db_session.scalar(
                select(func.count())
                .select_from(DropApplication)
                .where(DropApplication.org_id == ghost.id)
            )
            == 1
        )
        assert (
            await db_session.scalar(
                select(func.count()).select_from(SocialPost).where(SocialPost.org_id == ghost.id)
            )
            == 1
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
        await db_session.refresh(erased_user)
        await db_session.refresh(ghost_post)
        await db_session.refresh(live_post)
        assert ghost.follower_count is None
        assert ghost.university == ""
        assert ghost_post.likes == 400
        assert ghost_post.comments == 23
        assert ghost_post.reach == 2039
        assert ghost_post.views == 11
        assert ghost_post.saved == 4
        assert ghost_post.shares == 6
        assert ghost_post.reposts is None
        assert ghost_post.reels_skip_rate is None
        assert ghost_post.profile_visits is None
        assert ghost_post.caption == ""
        assert ghost_post.url == ""
        assert ghost_post.external_id == f"frozen-{ghost_post.id}"
        assert ghost_post.metrics_frozen_at is not None
        assert erased_user.instagram_granted_permissions is None
        assert live.follower_count == 40
        assert ghost.approved_at is None
        await db_session.refresh(ghost_intent)
        await db_session.refresh(live_intent)
        assert ghost_intent.pitch is None
        assert ghost_intent.status == DropApplyIntentStatus.EXPIRED.value
        assert live_intent.pitch == "Live chapter pitch"
        assert live_intent.status == DropApplyIntentStatus.OPEN.value
        assert live_post.profile_visits == 3
        assert live.university != ""
        assert "instagram.test" in live_post.url
        assert await db_session.get(Organization, ghost.id) is not None
        assert (
            await db_session.scalar(
                select(func.count())
                .select_from(PostCampaignLink)
                .where(PostCampaignLink.post_id == ghost_post.id)
            )
            == 1
        )
        assert (
            await db_session.scalar(
                select(func.count())
                .select_from(DropApplicationShipment)
                .where(DropApplicationShipment.application_id == ghost_app.id)
            )
            == 1
        )
        linked_erased_id = linked_erased.id
        unlinked_same_email_id = unlinked_same_email.id
        null_identity_id = null_identity.id
        live_owned_id = live_owned.id
        erased_user_id = erased_user.id
        live_user_id = live_user.id
        db_session.expire_all()
        assert await db_session.get(OrgApplyPrefill, linked_erased_id) is None
        assert await db_session.get(OrgApplyPrefill, unlinked_same_email_id) is not None
        assert await db_session.get(OrgApplyPrefill, null_identity_id) is not None
        assert await db_session.get(OrgApplyPrefill, live_owned_id) is not None
        assert (
            await db_session.scalar(
                select(func.count())
                .select_from(OrgConnectToken)
                .where(OrgConnectToken.user_id == erased_user_id)
            )
            == 0
        )
        assert (
            await db_session.scalar(
                select(func.count())
                .select_from(OrgConnectToken)
                .where(OrgConnectToken.user_id == live_user_id)
            )
            == 1
        )

    async def test_metric_sync_skips_erased(self, db_session):
        user, org, *_ = await _seed_erasable_org(db_session)
        user.status = OrgUserStatus.ERASED.value
        await db_session.flush()
        eligible = await _eligible_orgs(db_session, datetime.now(timezone.utc))
        assert org.id not in {o.id for o in eligible}

    async def test_metric_sync_does_not_refresh_frozen_posts(self, db_session, monkeypatch):
        user, org, _accepted, _applied, post = await _seed_erasable_org(db_session)
        post.metrics_frozen_at = datetime.now(timezone.utc)
        likes_before = post.likes
        await db_session.flush()

        class CountingIg:
            def __init__(self) -> None:
                self.media_fetches = 0

            async def fetch_user_media(self, _token: str) -> list[object]:
                return []

            async def fetch_media(self, _token: str, _media_id: str) -> object:
                self.media_fetches += 1
                raise AssertionError("frozen post must not be fetched")

            async def fetch_media_insights(
                self, _token: str, _media_id: str, *, is_reel: bool = False
            ) -> dict[str, int]:
                self.media_fetches += 1
                raise AssertionError("frozen post must not be fetched")

        monkeypatch.setattr("app.jobs.metric_sync.decrypt_token", lambda _token: "plain")
        ig = CountingIg()
        await sync_metrics_for_orgs(db_session, ig, [org])  # type: ignore[arg-type]
        await db_session.refresh(post)
        assert ig.media_fetches == 0
        assert post.likes == likes_before

    async def test_admin_delete_seat_drops_that_seat_only(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        monkeypatch.setattr(
            "app.services.admin_erase.send_org_erased_email",
            AsyncMock(return_value=True),
        )
        erased_user = await persist(db_session, make_user(role=PortalRole.ORG))
        erased_user.instagram_username = "GhostOrg"
        ghost = await make_org(db_session, erased_user, org_name="Ghost Greeks")
        live_user = await persist(db_session, make_user(role=PortalRole.ORG))
        live_user.instagram_username = "LiveOrg"
        live = await make_org(db_session, live_user, org_name="Live Club")
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        ghost_app = await make_application(
            db_session, drop, ghost, decision=ApplicationDecision.ACCEPTED
        )
        live_app = await make_application(
            db_session, drop, live, decision=ApplicationDecision.ACCEPTED
        )
        ghost_post = await make_social_post(db_session, ghost, likes=400, comments=23, reach=2039)
        live_post = await make_social_post(db_session, live, likes=8, comments=2, reach=100)
        await make_post_link(db_session, ghost_post, ghost_app)
        await make_post_link(db_session, live_post, live_app)
        db_session.add(
            DropApplicationShipment(
                application_id=ghost_app.id,
                tracking_number="1Z999",
                carrier="ups",
            )
        )
        await db_session.flush()
        headers = await admin_headers(db_session)
        erased = await app_client.post(
            f"/api/admin/orgs/{erased_user.id}/erase",
            headers=headers,
            json={"confirm": "@GhostOrg"},
        )
        assert erased.status_code == 200, erased.text

        url = f"/api/admin/drops/{drop.id}/applications/{ghost_app.id}/delete"
        brand_owner = await db_session.get(User, brand.user_id)
        assert brand_owner is not None
        brand_headers = {"Authorization": f"Bearer {mint_access_token(brand_owner)}"}
        forbidden = await app_client.post(url, headers=brand_headers, json={"confirm": "delete"})
        assert forbidden.status_code == 403

        other = await make_drop(db_session, brand, title="Other drop")
        idor = await app_client.post(
            f"/api/admin/drops/{other.id}/applications/{ghost_app.id}/delete",
            headers=headers,
            json={"confirm": "delete"},
        )
        assert idor.status_code == 404
        assert (
            await db_session.scalar(
                select(func.count())
                .select_from(DropApplication)
                .where(DropApplication.id == ghost_app.id)
            )
            == 1
        )

        refused = await app_client.post(url, headers=headers, json={"confirm": "nope"})
        assert refused.status_code == 400

        removed = await app_client.post(url, headers=headers, json={"confirm": "delete"})
        assert removed.status_code == 200, removed.text
        body = removed.json()["data"]
        assert body["postsRemoved"] == 1
        assert body["shipmentsRemoved"] == 1

        detail = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=brand_headers)
        assert detail.status_code == 200, detail.text
        data = detail.json()["data"]
        assert {row["orgId"] for row in data["applications"]} == {str(live.id)}
        assert data["totalEngagement"] == 10
        assert data["totalReach"] == 100
        assert data["totalPosts"] == 1

        assert (
            await db_session.scalar(
                select(func.count()).select_from(SocialPost).where(SocialPost.id == ghost_post.id)
            )
            == 0
        )
        assert (
            await db_session.scalar(
                select(func.count()).select_from(SocialPost).where(SocialPost.id == live_post.id)
            )
            == 1
        )
        assert (
            await db_session.scalar(
                select(func.count())
                .select_from(DropApplication)
                .where(DropApplication.id == ghost_app.id)
            )
            == 0
        )
        assert (
            await db_session.scalar(
                select(func.count())
                .select_from(DropApplication)
                .where(DropApplication.id == live_app.id)
            )
            == 1
        )
        assert (
            await db_session.scalar(
                select(func.count())
                .select_from(DropApplicationShipment)
                .where(DropApplicationShipment.application_id == ghost_app.id)
            )
            == 0
        )
        audit = await db_session.scalar(
            select(AdminAuditEvent).where(AdminAuditEvent.application_id == ghost_app.id)
        )
        assert audit is not None
        assert audit.action == "seat_deleted"
        assert audit.drop_id == drop.id
        assert audit.org_id == ghost.id
        assert audit.detail is not None
        assert audit.detail["shipments_removed"] == 1
        assert set(audit.detail) == {
            "posts_removed",
            "shipments_removed",
            "allocated_units",
            "account_erased",
        }
        assert "1Z999" not in str(audit.detail)
        assert "GhostOrg" not in str(audit.detail)

        again = await app_client.post(url, headers=headers, json={"confirm": "delete"})
        assert again.status_code == 404

    async def test_frozen_post_cannot_be_relinked(self, db_session):
        user, _org, accepted, _applied, post = await _seed_erasable_org(db_session)
        post.metrics_frozen_at = datetime.now(timezone.utc)
        user.status = OrgUserStatus.ACTIVE.value
        await db_session.flush()

        with pytest.raises(BuzzAPIException) as link_exc:
            await link_post(db_session, user, accepted.id, post.id)
        assert link_exc.value.status_code == 400
        with pytest.raises(BuzzAPIException) as unlink_exc:
            await unlink_post(db_session, user, accepted.id, post.id)
        assert unlink_exc.value.status_code == 400
        assert (
            await db_session.scalar(
                select(func.count())
                .select_from(PostCampaignLink)
                .where(PostCampaignLink.post_id == post.id)
            )
            == 1
        )

    async def test_autolink_skips_frozen_posts_and_erased_orgs(self, db_session):
        from app.models.brand import Brand
        from app.models.drop import Drop

        user, _org, accepted, _applied, post = await _seed_erasable_org(db_session)
        drop = await db_session.get(Drop, accepted.drop_id)
        assert drop is not None
        brand = await db_session.get(Brand, drop.brand_id)
        assert brand is not None
        brand.instagram_handle = "acme"
        post.caption = "thanks @acme"
        post.metrics_frozen_at = datetime.now(timezone.utc)
        await db_session.flush()

        await scan_autolink(db_session)
        frozen_suggestions = await db_session.scalar(
            select(func.count())
            .select_from(PostCampaignSuggestion)
            .where(PostCampaignSuggestion.post_id == post.id)
        )
        assert frozen_suggestions == 0

        post.metrics_frozen_at = None
        post.external_id = f"ext-{post.id}"
        user.status = OrgUserStatus.ERASED.value
        await db_session.flush()
        await scan_autolink(db_session)
        erased_suggestions = await db_session.scalar(
            select(func.count())
            .select_from(PostCampaignSuggestion)
            .where(PostCampaignSuggestion.application_id == accepted.id)
        )
        assert erased_suggestions == 0

    async def test_metric_sync_does_not_list_media_for_erased_org(self, db_session, monkeypatch):
        user, org, *_ = await _seed_erasable_org(db_session)
        user.status = OrgUserStatus.ERASED.value
        await db_session.flush()

        class CountingIg:
            def __init__(self) -> None:
                self.lists = 0

            async def fetch_user_media(self, _token: str) -> list[object]:
                self.lists += 1
                return []

            async def fetch_media(self, _token: str, _media_id: str) -> object:
                raise AssertionError("erased org must not be fetched")

            async def fetch_media_insights(
                self, _token: str, _media_id: str, *, is_reel: bool = False
            ):
                raise AssertionError("erased org must not be fetched")

        monkeypatch.setattr("app.jobs.metric_sync.decrypt_token", lambda _token: "plain")
        ig = CountingIg()
        await sync_metrics_for_orgs(db_session, ig, [org])  # type: ignore[arg-type]
        assert ig.lists == 0

    async def test_instagram_login_does_not_rebind_erased_org(self, db_session):
        user, org, *_ = await _seed_erasable_org(db_session)
        user.status = OrgUserStatus.ERASED.value
        user.instagram_user_id = "ig_left_behind"
        user.instagram_username = None
        user.instagram_access_token = None
        org.follower_count = None
        await db_session.flush()
        fake = FakeInstagramClient(user_id="ig_left_behind")
        fake.username = "revived"

        with pytest.raises(BuzzAPIException) as exc:
            await handle_instagram_callback(db_session, fake, "code")
        assert exc.value.status_code == 403
        assert user.instagram_username is None
        assert user.instagram_access_token is None
        assert user.status == OrgUserStatus.ERASED.value
        assert org.follower_count is None

    async def test_erasure_email_matches_retained_metrics(self):
        body = _org_erased_body("Campus Greeks")
        assert "likes, comments, reach, views, saves, and shares" in body
        assert "profile visits" in body
        assert "similar" not in body
        assert "tracking numbers" in body


class TestEraseRefreshGate:
    async def test_refresh_refuses_erased(self, app_client: AsyncClient, db_session):
        user = await persist(
            db_session, make_user(role=PortalRole.ORG, status=OrgUserStatus.ERASED)
        )
        refresh = jwt.create_refresh_token(user.id, token_version=user.token_version or 0)
        set_request_cookies(app_client, {settings.REFRESH_COOKIE_NAME: refresh})
        res = await app_client.post("/api/auth/refresh")
        assert res.status_code == 401
