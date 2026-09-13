"""Admin on-demand Graph sync + autolink (PRODUCT §10)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy import select

from app.models.enums import ApplicationDecision, BrandTrackerStage, PortalRole
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.social_post import SocialPost
from app.security.token_crypto import encrypt_token
from app.services.instagram import MediaFields, MediaRef
from tests.conftest import (
    FakeInstagramClient,
    make_application,
    make_brand,
    make_drop,
    make_org,
    make_social_post,
    make_user,
    mint_access_token,
    persist,
)


async def _admin_headers(db_session) -> dict:
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


async def _active_seat(db_session, *, handle: str = "nike"):
    org_user = await persist(
        db_session, make_user(role=PortalRole.ORG, instagram_user_id="ig_sync")
    )
    org_user.instagram_access_token = encrypt_token("long-lived")
    org_user.instagram_token_expires_at = datetime.now(timezone.utc) + timedelta(days=50)
    org = await make_org(db_session, org_user, org_name="Sync Club")
    org.follower_count = 5
    brand = await make_brand(db_session)
    brand.instagram_handle = handle
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_ACTIVE)
    await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
    await db_session.flush()
    return org_user, org, drop


class TestAdminSyncAutolink:
    async def test_discovers_then_suggests(
        self,
        app_client: AsyncClient,
        db_session,
        fake_instagram: FakeInstagramClient,
    ):
        _, org, drop = await _active_seat(db_session)
        posted = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S%z")
        fake_instagram.media = [MediaRef(id="m1", timestamp=posted)]
        fake_instagram.media_fields = {
            "m1": MediaFields(
                id="m1",
                caption="so hyped for the @nike drop today",
                media_type="IMAGE",
                media_product_type="FEED",
                permalink="https://instagram.com/p/m1",
                thumbnail_url=None,
                media_url=None,
                timestamp=posted,
                like_count=12,
                comments_count=3,
            )
        }
        fake_instagram.followers_count = 9999

        res = await app_client.post(
            f"/api/admin/drops/{drop.id}/sync-and-autolink",
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["orgs"] == 1
        assert data["postsDiscovered"] == 1
        assert data["skippedToken"] == 0
        assert data["suggestionsCreated"] == 1
        assert "followersRefreshed" not in data

        post = await db_session.scalar(select(SocialPost).where(SocialPost.external_id == "m1"))
        assert post is not None
        sug = await db_session.scalar(select(PostCampaignSuggestion))
        assert sug is not None
        assert sug.confirmed_at is None
        await db_session.refresh(org)
        assert org.follower_count == 5

    async def test_skips_token_and_still_scans_db(
        self,
        app_client: AsyncClient,
        db_session,
        fake_instagram: FakeInstagramClient,
    ):
        org_user, org, drop = await _active_seat(db_session)
        org_user.instagram_access_token = None
        await db_session.flush()
        await make_social_post(db_session, org, caption="love @nike collab")
        res = await app_client.post(
            f"/api/admin/drops/{drop.id}/sync-and-autolink",
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["postsDiscovered"] == 0
        assert data["suggestionsCreated"] == 1

    async def test_scoped_to_this_drop(
        self,
        app_client: AsyncClient,
        db_session,
        fake_instagram: FakeInstagramClient,
    ):
        _, org_a, drop_a = await _active_seat(db_session)
        other_user = await persist(
            db_session, make_user(role=PortalRole.ORG, instagram_user_id="ig_other")
        )
        other_user.instagram_access_token = encrypt_token("long-lived")
        other_user.instagram_token_expires_at = datetime.now(timezone.utc) + timedelta(days=50)
        org_b = await make_org(db_session, other_user, org_name="Other Club")
        brand_b = await make_brand(db_session)
        brand_b.instagram_handle = "adidas"
        drop_b = await make_drop(db_session, brand_b, stage=BrandTrackerStage.DROP_ACTIVE)
        await make_application(db_session, drop_b, org_b, decision=ApplicationDecision.ACCEPTED)
        await make_social_post(db_session, org_b, caption="go @adidas")
        fake_instagram.media = []

        res = await app_client.post(
            f"/api/admin/drops/{drop_a.id}/sync-and-autolink",
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200, res.text
        assert res.json()["data"]["suggestionsCreated"] == 0
        count = await db_session.scalar(select(PostCampaignSuggestion))
        assert count is None
        assert org_a.id != org_b.id

    async def test_refuse_non_active(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        awaiting = await make_drop(db_session, brand, stage=BrandTrackerStage.AWAITING_PRODUCTS)
        finished = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_FINISHED)
        draft = await make_drop(
            db_session, brand, stage=BrandTrackerStage.DROP_ACTIVE, published_at=None
        )
        hidden = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_ACTIVE)
        hidden.hidden_at = datetime.now(timezone.utc)
        await db_session.flush()
        headers = await _admin_headers(db_session)
        for drop in (awaiting, finished, draft, hidden):
            res = await app_client.post(
                f"/api/admin/drops/{drop.id}/sync-and-autolink",
                headers=headers,
            )
            assert res.status_code == 409, drop.brand_tracker_stage
            assert res.json()["error"]["code"] == "DROP_NOT_ELIGIBLE"
