"""Admin org hybrid erase (PRODUCT.md §3.1.2 / §4.3)."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

from httpx import AsyncClient
from sqlalchemy import func, select

from app.config import settings
from app.jobs.metric_sync import _eligible_orgs
from app.models.brand import Brand
from app.models.drop import Drop
from app.models.enums import (
    ApplicationDecision,
    BrandTrackerStage,
    OrgCategory,
    OrgUserStatus,
    PortalRole,
)
from app.models.notify_me import NotifyMe
from app.models.post_link import PostCampaignLink
from app.models.user import User
from app.security import jwt
from tests.conftest import (
    make_application,
    make_brand,
    make_drop,
    make_notify,
    make_org,
    make_post_link,
    make_social_post,
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
    async def test_erase_scrubs_identity_keeps_kpis(
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
        await db_session.refresh(post)
        await db_session.refresh(accepted)
        await db_session.refresh(applied)

        assert user.status == OrgUserStatus.ERASED.value
        assert user.instagram_username is None
        assert user.instagram_user_id is None
        assert user.edu_email is None
        assert user.pending_edu_email is None
        assert user.instagram_access_token is None
        assert user.token_version == 2
        assert org.org_name == "Deleted organization"
        assert org.follower_count == 1500
        assert org.university == "State U"
        assert org.delivery_address is None
        assert org.shipping_line1 is None
        assert org.shipping_city is None
        assert org.shipping_state is None
        assert org.shipping_postal_code is None
        assert org.contact_name is None
        assert accepted.decision == ApplicationDecision.ACCEPTED.value
        assert accepted.pitch is None
        assert applied.decision == ApplicationDecision.DENIED.value
        assert post.likes == 12
        assert post.comments == 3
        assert post.external_id == f"erased-{post.id}"
        assert post.url == f"erased://post/{post.id}"
        assert post.caption == "[removed]"
        assert post.thumbnail_url is None
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

    async def test_account_erased_on_brand_and_admin_drop(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        monkeypatch.setattr(
            "app.services.admin_erase.send_org_erased_email",
            AsyncMock(return_value=True),
        )
        user, org, accepted, _, _ = await _seed_erasable_org(db_session)
        headers = await _admin_headers(db_session)
        await app_client.post(
            f"/api/admin/orgs/{user.id}/erase",
            headers=headers,
            json={"confirm": "CampusGreeks"},
        )

        admin_drop = await app_client.get(f"/api/admin/drops/{accepted.drop_id}", headers=headers)
        applicants = admin_drop.json()["data"]["applicants"]
        mine = next(a for a in applicants if a["orgId"] == str(org.id))
        assert mine["accountErased"] is True

        drop = await db_session.get(Drop, accepted.drop_id)
        assert drop is not None
        brand = await db_session.get(Brand, drop.brand_id)
        assert brand is not None
        brand_owner = await db_session.get(User, brand.user_id)
        assert brand_owner is not None
        brand_headers = {"Authorization": f"Bearer {mint_access_token(brand_owner)}"}
        brand_res = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=brand_headers)
        assert brand_res.status_code == 200
        brand_apps = brand_res.json()["data"]["applications"]
        brand_mine = next(a for a in brand_apps if a["orgId"] == str(org.id))
        assert brand_mine["accountErased"] is True
        assert brand_mine["attributedLikes"] == 12

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
