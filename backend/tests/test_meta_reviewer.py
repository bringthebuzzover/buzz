"""Temporary Meta App Review reviewer path. Flag off is a 404 with no side effects."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.config import settings
from app.meta_reviewer.gate import DEFAULT_REVIEWER_ORG_EMAIL
from app.meta_reviewer.seed import purge_reviewer_org
from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.enums import (
    ApplicationDecision,
    BrandTrackerStage,
    OrgUserStatus,
    Platform,
    PortalRole,
    SocialMediaProductType,
    SocialMediaType,
    SuggestionMatchReason,
)
from app.models.organization import Organization
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.social_post import SocialPost
from app.models.user import User
from app.security import jwt, rate_limit
from app.services.instagram import MediaFields, MediaRef
from tests.conftest import (
    FakeInstagramClient,
    make_application,
    make_brand,
    make_drop,
    make_org,
    make_post_link,
    make_social_post,
    make_user,
    mint_access_token,
    persist,
    set_request_cookies,
)

SECRET = "reviewer-test-secret"
SECRET_HASH = hashlib.sha256(SECRET.encode("utf-8")).hexdigest()
OTHER_SECRET = "reviewer-test-secret-rotated"
OTHER_HASH = hashlib.sha256(OTHER_SECRET.encode("utf-8")).hexdigest()


def _enable(monkeypatch: pytest.MonkeyPatch, drop_id: uuid.UUID | None) -> None:
    monkeypatch.setattr(settings, "META_REVIEWER_ACCESS_ENABLED", True)
    monkeypatch.setattr(settings, "META_REVIEWER_LINK_SECRET_HASH", SECRET_HASH)
    monkeypatch.setattr(settings, "META_REVIEWER_ORG_EMAIL", DEFAULT_REVIEWER_ORG_EMAIL)
    monkeypatch.setattr(settings, "META_REVIEWER_DROP_ID", "" if drop_id is None else str(drop_id))


def _recent_stamp() -> str:
    posted = datetime.now(timezone.utc) - timedelta(hours=1)
    return posted.strftime("%Y-%m-%dT%H:%M:%S%z")


def _arm_media(fake: FakeInstagramClient, *, media_id: str, caption: str) -> None:
    stamp = _recent_stamp()
    fake.media = [MediaRef(id=media_id, timestamp=stamp)]
    fake.media_fields = {
        media_id: MediaFields(
            id=media_id,
            caption=caption,
            media_type="IMAGE",
            media_product_type="FEED",
            permalink=f"https://instagram.com/p/{media_id}",
            thumbnail_url=None,
            media_url=None,
            timestamp=stamp,
            like_count=4,
            comments_count=1,
        )
    }


async def _seed_drop(db: AsyncSession):
    brand = await make_brand(db, brand_name="Review Brand")
    brand.instagram_handle = "acmebrand"
    drop = await make_drop(
        db,
        brand,
        title="Meta Review Test Drop",
        stage=BrandTrackerStage.AWAITING_PRODUCTS,
    )
    return brand, drop


async def _admin_headers(db: AsyncSession) -> dict[str, str]:
    admin = await persist(db, make_user(role=PortalRole.ADMIN, status=OrgUserStatus.ACTIVE))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


async def _seed_via_api(
    client: AsyncClient, db: AsyncSession, drop_id: uuid.UUID
) -> dict[str, object]:
    headers = await _admin_headers(db)
    resp = await client.post("/api/meta-reviewer/seed", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()["data"]
    assert body["dropId"] == str(drop_id)
    again = await client.post("/api/meta-reviewer/seed", headers=headers)
    assert again.status_code == 200, again.text
    assert again.json()["data"]["createdUser"] is False
    assert again.json()["data"]["createdApplication"] is False
    return body


def _state_from(start_resp) -> str:
    return parse_qs(urlparse(start_resp.json()["data"]["authorizeUrl"]).query)["state"][0]


async def test_flag_off_is_404_without_side_effects(
    app_client: AsyncClient,
    fake_instagram: FakeInstagramClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "META_REVIEWER_ACCESS_ENABLED", False)
    monkeypatch.setattr(settings, "META_REVIEWER_LINK_SECRET_HASH", SECRET_HASH)
    before = await db_session.scalar(select(func.count()).select_from(User))

    start = await app_client.post("/api/meta-reviewer/start", json={"token": SECRET})
    seed = await app_client.post(
        "/api/meta-reviewer/seed",
        headers={"Authorization": "Bearer not-a-token"},
    )
    state = jwt.create_oauth_state_token(bind_user_id=uuid.uuid4(), reviewer=True)
    set_request_cookies(app_client, {settings.OAUTH_STATE_COOKIE_NAME: state})
    callback = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "oauth-code", "state": state},
    )

    assert start.status_code == 404
    assert start.json()["error"]["code"] == errors.NOT_FOUND
    assert seed.status_code == 404
    assert callback.status_code == 404
    assert fake_instagram.seen_code is None
    after = await db_session.scalar(select(func.count()).select_from(User))
    assert after == before
    reviewer = await db_session.scalar(
        select(User).where(User.edu_email == DEFAULT_REVIEWER_ORG_EMAIL)
    )
    assert reviewer is None


async def test_flag_off_does_not_consume_rate_limit(
    app_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings.RATE_LIMIT_ENABLED = True
    rate_limit.reset()
    monkeypatch.setattr(settings, "META_REVIEWER_ACCESS_ENABLED", False)
    headers = {"X-Real-IP": "203.0.113.10"}
    try:
        for _ in range(12):
            resp = await app_client.post(
                "/api/meta-reviewer/start",
                json={"token": SECRET},
                headers=headers,
            )
            assert resp.status_code == 404
        monkeypatch.setattr(settings, "META_REVIEWER_ACCESS_ENABLED", True)
        monkeypatch.setattr(settings, "META_REVIEWER_LINK_SECRET_HASH", SECRET_HASH)
        allowed = await app_client.post(
            "/api/meta-reviewer/start",
            json={"token": "wrong"},
            headers=headers,
        )
        assert allowed.status_code == 401
    finally:
        settings.RATE_LIMIT_ENABLED = False
        rate_limit.reset()


async def test_invalid_and_rotated_secret_rejected(
    app_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _brand, drop = await _seed_drop(db_session)
    _enable(monkeypatch, drop.id)
    await _seed_via_api(app_client, db_session, drop.id)

    missing = await app_client.post("/api/meta-reviewer/start", json={"token": "nope"})
    assert missing.status_code == 401
    assert missing.json()["error"]["code"] == errors.UNAUTHORIZED

    monkeypatch.setattr(settings, "META_REVIEWER_LINK_SECRET_HASH", "")
    unset = await app_client.post("/api/meta-reviewer/start", json={"token": SECRET})
    assert unset.status_code == 401

    monkeypatch.setattr(settings, "META_REVIEWER_LINK_SECRET_HASH", OTHER_HASH)
    rotated = await app_client.post("/api/meta-reviewer/start", json={"token": SECRET})
    assert rotated.status_code == 401
    fresh = await app_client.post("/api/meta-reviewer/start", json={"token": OTHER_SECRET})
    assert fresh.status_code == 200
    payload = jwt.decode_token(_state_from(fresh), expected_type=jwt.OAUTH_STATE_TOKEN_TYPE)
    assert payload.reviewer is True
    assert payload.next is None


async def test_secret_not_logged_or_echoed(
    app_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    _brand, drop = await _seed_drop(db_session)
    _enable(monkeypatch, drop.id)
    await _seed_via_api(app_client, db_session, drop.id)
    caplog.set_level("DEBUG")
    bad = await app_client.post(
        "/api/meta-reviewer/start?token=" + SECRET,
        json={"token": [SECRET]},
    )
    assert bad.status_code == 422
    assert SECRET not in bad.text
    ok = await app_client.post(
        "/api/meta-reviewer/start", json={"token": SECRET, "next": "https://evil.example"}
    )
    assert ok.status_code == 200
    assert "evil.example" not in ok.text
    # httpx logs the URL the test client sent. Server logs must not.
    server_logs = "\n".join(
        record.getMessage() for record in caplog.records if not record.name.startswith("httpx")
    )
    assert SECRET not in server_logs
    state = jwt.decode_token(_state_from(ok), expected_type=jwt.OAUTH_STATE_TOKEN_TYPE)
    assert state.next is None
    assert "evil.example" not in ok.json()["data"]["authorizeUrl"]


async def test_rate_limit(app_client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    settings.RATE_LIMIT_ENABLED = True
    rate_limit.reset()
    monkeypatch.setattr(settings, "META_REVIEWER_ACCESS_ENABLED", True)
    monkeypatch.setattr(settings, "META_REVIEWER_LINK_SECRET_HASH", SECRET_HASH)
    headers = {"X-Real-IP": "203.0.113.20"}
    try:
        for _ in range(10):
            resp = await app_client.post(
                "/api/meta-reviewer/start",
                json={"token": "wrong"},
                headers=headers,
            )
            assert resp.status_code == 401
        blocked = await app_client.post(
            "/api/meta-reviewer/start",
            json={"token": SECRET},
            headers=headers,
        )
        assert blocked.status_code == 429
        assert blocked.json()["error"]["code"] == errors.RATE_LIMITED
        # A spoofed X-Forwarded-For must not open a new bucket. Railway's
        # edge sets X-Real-IP; that header is the bucket key.
        spoofed = await app_client.post(
            "/api/meta-reviewer/start",
            json={"token": SECRET},
            headers={**headers, "X-Forwarded-For": "198.51.100.9"},
        )
        assert spoofed.status_code == 429
    finally:
        settings.RATE_LIMIT_ENABLED = False
        rate_limit.reset()


async def test_seed_requires_admin_and_drop(
    app_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable(monkeypatch, None)
    admin = await _admin_headers(db_session)
    missing = await app_client.post("/api/meta-reviewer/seed", headers=admin)
    assert missing.status_code == 400
    assert (
        await db_session.scalar(select(User).where(User.edu_email == DEFAULT_REVIEWER_ORG_EMAIL))
        is None
    )

    _brand, drop = await _seed_drop(db_session)
    monkeypatch.setattr(settings, "META_REVIEWER_DROP_ID", str(drop.id))
    anon = await app_client.post("/api/meta-reviewer/seed")
    assert anon.status_code == 401
    org_user = await persist(db_session, make_user())
    org_headers = {"Authorization": f"Bearer {mint_access_token(org_user)}"}
    forbidden = await app_client.post("/api/meta-reviewer/seed", headers=org_headers)
    assert forbidden.status_code == 403

    monkeypatch.setattr(settings, "META_REVIEWER_ACCESS_ENABLED", False)
    hidden = await app_client.post("/api/meta-reviewer/seed", headers=admin)
    assert hidden.status_code == 404


async def test_valid_link_binds_syncs_and_stays_in_reviewer_org(
    app_client: AsyncClient,
    fake_instagram: FakeInstagramClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _brand, drop = await _seed_drop(db_session)
    _enable(monkeypatch, drop.id)
    seeded = await _seed_via_api(app_client, db_session, drop.id)

    other = await persist(db_session, make_user(instagram_username="secretstudent"))
    other_org = await make_org(db_session, other, org_name="Secret Student Org")
    other_app = await make_application(
        db_session, drop, other_org, decision=ApplicationDecision.ACCEPTED
    )
    other_post = SocialPost(
        org_id=other_org.id,
        platform=Platform.INSTAGRAM.value,
        external_id="otherpost",
        url="https://instagram.com/p/otherpost",
        caption="hello @acmebrand",
        media_type=SocialMediaType.IMAGE.value,
        media_product_type=SocialMediaProductType.FEED.value,
        posted_at=datetime.now(timezone.utc) - timedelta(hours=1),
        likes=1,
        comments=0,
    )
    db_session.add(other_post)
    await db_session.flush()

    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_reviewer_1"
    fake_instagram.username = "reviewerone"
    _arm_media(fake_instagram, media_id="revpost1", caption="hello @acmebrand")

    start = await app_client.post("/api/meta-reviewer/start", json={"token": SECRET})
    assert start.status_code == 200
    assert "buzz_oauth_state" in start.headers.get("set-cookie", "")
    state = _state_from(start)
    decoded = jwt.decode_token(state, expected_type=jwt.OAUTH_STATE_TOKEN_TYPE)
    assert decoded.bind == seeded["userId"]
    assert decoded.reviewer is True

    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "oauth-code", "state": state},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()["data"]
    assert body["user"]["id"] == seeded["userId"]
    assert body["user"]["portal_role"] == "org"
    assert body["user"]["status"] == "active"
    assert body["user"]["email"] == DEFAULT_REVIEWER_ORG_EMAIL
    assert body["next"] is None
    token = body["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    reviewer = await db_session.get(User, uuid.UUID(seeded["userId"]))
    assert reviewer is not None
    assert reviewer.instagram_user_id == "ig_reviewer_1"
    assert reviewer.instagram_username == "reviewerone"
    org = await db_session.get(Organization, uuid.UUID(seeded["orgId"]))
    assert org is not None
    assert org.instagram_handle_confirmed is True
    post = await db_session.scalar(
        select(SocialPost).where(SocialPost.org_id == org.id, SocialPost.external_id == "revpost1")
    )
    assert post is not None
    assert post.reach == 100
    assert post.metrics_updated_at is not None
    suggestion = await db_session.scalar(
        select(PostCampaignSuggestion).where(PostCampaignSuggestion.post_id == post.id)
    )
    assert suggestion is not None
    other_suggestion = await db_session.scalar(
        select(PostCampaignSuggestion).where(PostCampaignSuggestion.post_id == other_post.id)
    )
    assert other_suggestion is None

    posts = await app_client.get("/api/orgs/me/posts", headers=auth)
    assert posts.status_code == 200
    assert len(posts.json()["data"]) == 1
    campaigns = await app_client.get("/api/campaigns", headers=auth)
    assert campaigns.status_code == 200
    listed = campaigns.json()["data"]
    assert len(listed) == 1
    assert listed[0]["dropId"] == str(drop.id)
    assert "Secret Student Org" not in campaigns.text

    linked = await app_client.post(
        f"/api/campaigns/{listed[0]['id']}/link-post",
        headers=auth,
        json={"postId": posts.json()["data"][0]["id"]},
    )
    assert linked.status_code == 200, linked.text

    other_campaign = await app_client.get(f"/api/campaigns/{other_app.id}", headers=auth)
    assert other_campaign.status_code == 404
    admin = await app_client.get("/api/admin/orgs", headers=auth)
    assert admin.status_code == 403
    brand = await app_client.get("/api/brands/me", headers=auth)
    assert brand.status_code == 403
    create_drop = await app_client.post(f"/api/admin/drops/{drop.id}/publish", headers=auth)
    assert create_drop.status_code == 403
    await db_session.refresh(drop)
    assert drop.brand_tracker_stage == BrandTrackerStage.AWAITING_PRODUCTS.value

    second = await make_drop(db_session, _brand, title="Real Campus Drop")
    applied = await app_client.post(
        f"/api/drops/{second.id}/apply",
        headers=auth,
        json={"pitch": "no"},
    )
    assert applied.status_code == 403
    notify = await app_client.post(
        f"/api/drops/{second.id}/notify",
        headers=auth,
        json={"reminderMinutes": 15},
    )
    assert notify.status_code == 403
    ig_change = await app_client.post(
        "/api/orgs/me/ig-change-requests",
        headers=auth,
        json={"requestedHandle": "someoneelse", "reason": "no", "kind": "rename"},
    )
    assert ig_change.status_code == 403
    profile = await app_client.patch(
        "/api/orgs/me",
        headers=auth,
        json={"orgName": "Renamed"},
    )
    assert profile.status_code == 403
    extra = await db_session.scalar(
        select(func.count())
        .select_from(DropApplication)
        .where(DropApplication.org_id == org.id, DropApplication.drop_id == second.id)
    )
    assert extra == 0


async def test_login_still_rejects_unknown_accounts(
    app_client: AsyncClient,
    fake_instagram: FakeInstagramClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _brand, drop = await _seed_drop(db_session)
    _enable(monkeypatch, drop.id)
    seeded = await _seed_via_api(app_client, db_session, drop.id)
    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_stranger"
    fake_instagram.username = "stranger"
    login = await app_client.get("/api/auth/instagram/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    decoded = jwt.decode_token(state, expected_type=jwt.OAUTH_STATE_TOKEN_TYPE)
    assert decoded.reviewer is None
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "oauth-code", "state": state},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == errors.ORG_APPLY_REQUIRED
    reviewer = await db_session.get(User, uuid.UUID(seeded["userId"]))
    assert reviewer is not None
    assert reviewer.instagram_user_id is None
    stranger = await db_session.scalar(select(User).where(User.instagram_user_id == "ig_stranger"))
    assert stranger is None


async def test_personal_and_taken_accounts_do_not_bind(
    app_client: AsyncClient,
    fake_instagram: FakeInstagramClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _brand, drop = await _seed_drop(db_session)
    _enable(monkeypatch, drop.id)
    seeded = await _seed_via_api(app_client, db_session, drop.id)

    fake_instagram.account_type = "PERSONAL"
    fake_instagram.user_id = "ig_personal"
    start = await app_client.post("/api/meta-reviewer/start", json={"token": SECRET})
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "oauth-code", "state": _state_from(start)},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == errors.INSTAGRAM_PERSONAL_ACCOUNT
    reviewer = await db_session.get(User, uuid.UUID(seeded["userId"]))
    assert reviewer is not None
    assert reviewer.instagram_user_id is None

    owner = await persist(
        db_session,
        make_user(
            status=OrgUserStatus.ACTIVE,
            instagram_user_id="ig_owned",
            instagram_username="ownedhandle",
        ),
    )
    fake_instagram.account_type = "MEDIA_CREATOR"
    fake_instagram.user_id = "ig_owned"
    fake_instagram.username = "ownedhandle"
    start = await app_client.post("/api/meta-reviewer/start", json={"token": SECRET})
    taken = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "oauth-code", "state": _state_from(start)},
    )
    assert taken.status_code == 409
    assert taken.json()["error"]["code"] == errors.INSTAGRAM_HANDLE_TAKEN
    await db_session.refresh(reviewer)
    await db_session.refresh(owner)
    assert reviewer.instagram_user_id is None
    assert owner.instagram_user_id == "ig_owned"


async def test_rebind_clears_previous_handle(
    app_client: AsyncClient,
    fake_instagram: FakeInstagramClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _brand, drop = await _seed_drop(db_session)
    _enable(monkeypatch, drop.id)
    seeded = await _seed_via_api(app_client, db_session, drop.id)

    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_first"
    fake_instagram.username = "firsthandle"
    _arm_media(fake_instagram, media_id="firstpost", caption="hello @acmebrand")
    start = await app_client.post("/api/meta-reviewer/start", json={"token": SECRET})
    first = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c1", "state": _state_from(start)},
    )
    assert first.status_code == 200, first.text

    fake_instagram.user_id = "ig_second"
    fake_instagram.username = "secondhandle"
    fake_instagram.media = []
    start = await app_client.post("/api/meta-reviewer/start", json={"token": SECRET})
    second = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c2", "state": _state_from(start)},
    )
    assert second.status_code == 200, second.text
    assert second.json()["data"]["user"]["id"] == seeded["userId"]

    reviewer = await db_session.get(User, uuid.UUID(seeded["userId"]))
    assert reviewer is not None
    assert reviewer.instagram_user_id == "ig_second"
    assert reviewer.instagram_username == "secondhandle"
    assert reviewer.edu_email == DEFAULT_REVIEWER_ORG_EMAIL
    leftover = await db_session.scalar(select(User).where(User.instagram_user_id == "ig_first"))
    assert leftover is None
    org = await db_session.get(Organization, uuid.UUID(str(seeded["orgId"])))
    assert org is not None
    posts = await db_session.scalar(
        select(func.count()).select_from(SocialPost).where(SocialPost.org_id == org.id)
    )
    assert posts == 0

    fake_instagram.user_id = "ig_first"
    fake_instagram.username = "firsthandle"
    login = await app_client.get("/api/auth/instagram/login", follow_redirects=False)
    old_state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    rejected = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c3", "state": old_state},
    )
    assert rejected.status_code == 400
    assert rejected.json()["error"]["code"] == errors.ORG_APPLY_REQUIRED


async def test_forged_bind_does_not_touch_another_user(
    app_client: AsyncClient,
    fake_instagram: FakeInstagramClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _brand, drop = await _seed_drop(db_session)
    _enable(monkeypatch, drop.id)
    await _seed_via_api(app_client, db_session, drop.id)
    victim = await persist(
        db_session,
        make_user(status=OrgUserStatus.ACTIVE, instagram_user_id=None, instagram_username="victim"),
    )
    fake_instagram.user_id = "ig_victim_bind"
    fake_instagram.username = "victimbind"
    state = jwt.create_oauth_state_token(bind_user_id=victim.id, reviewer=True)
    set_request_cookies(app_client, {settings.OAUTH_STATE_COOKIE_NAME: state})
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "oauth-code", "state": state},
    )
    assert resp.status_code == 404
    assert fake_instagram.seen_code is None
    await db_session.refresh(victim)
    assert victim.instagram_user_id is None


async def test_callback_without_cookie_is_rejected(
    app_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _brand, drop = await _seed_drop(db_session)
    _enable(monkeypatch, drop.id)
    seeded = await _seed_via_api(app_client, db_session, drop.id)
    state = jwt.create_oauth_state_token(bind_user_id=seeded["userId"], reviewer=True)
    set_request_cookies(app_client, {})
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "oauth-code", "state": state},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == errors.OAUTH_STATE_INVALID


async def test_purge_removes_reviewer_org_and_keeps_the_drop(
    app_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _brand, drop = await _seed_drop(db_session)
    _enable(monkeypatch, drop.id)
    seeded = await _seed_via_api(app_client, db_session, drop.id)
    other = await persist(db_session, make_user())
    await make_org(db_session, other, org_name="Keep Me")
    monkeypatch.setattr(settings, "META_REVIEWER_ACCESS_ENABLED", False)
    deleted = await purge_reviewer_org(db_session)
    assert deleted is True
    assert await db_session.get(User, uuid.UUID(str(seeded["userId"]))) is None
    assert await db_session.get(Organization, uuid.UUID(str(seeded["orgId"]))) is None
    assert await db_session.get(Drop, drop.id) is not None
    kept = await db_session.scalar(select(Organization).where(Organization.org_name == "Keep Me"))
    assert kept is not None
    again = await purge_reviewer_org(db_session)
    assert again is False


async def test_reviewer_cannot_rotate_email_even_with_flag_off(
    app_client: AsyncClient,
    fake_instagram: FakeInstagramClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A reviewer session must not detach the email purge keys on.

    Flag off 404s the routes but does not unlock the seeded account.
    A normal org can still rotate.
    """

    _brand, drop = await _seed_drop(db_session)
    _enable(monkeypatch, drop.id)
    seeded = await _seed_via_api(app_client, db_session, drop.id)
    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_escape"
    fake_instagram.username = "escapehandle"
    start = await app_client.post("/api/meta-reviewer/start", json={"token": SECRET})
    signed_in = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "oauth-code", "state": _state_from(start)},
    )
    assert signed_in.status_code == 200, signed_in.text
    auth = {"Authorization": f"Bearer {signed_in.json()['data']['access_token']}"}

    student = make_user()
    student.edu_email = "student-rotate@university.edu"
    student.email_verified_at = datetime.now(timezone.utc)
    student = await persist(db_session, student)
    await make_org(db_session, student, org_name="Normal Campus Org")
    student_auth = {"Authorization": f"Bearer {mint_access_token(student)}"}

    blocked = await app_client.post(
        "/api/auth/verify-email/rotate",
        headers=auth,
        json={"eduEmail": "escape@university.edu"},
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == errors.FORBIDDEN

    allowed = await app_client.post(
        "/api/auth/verify-email/rotate",
        headers=student_auth,
        json={"eduEmail": "student-next@university.edu"},
    )
    assert allowed.status_code == 200, allowed.text

    monkeypatch.setattr(settings, "META_REVIEWER_ACCESS_ENABLED", False)
    still_blocked = await app_client.post(
        "/api/auth/verify-email/rotate",
        headers=auth,
        json={"eduEmail": "escape@university.edu"},
    )
    assert still_blocked.status_code == 403
    renamed = await app_client.patch(
        "/api/orgs/me",
        headers=auth,
        json={"orgName": "Not The Reviewer"},
    )
    assert renamed.status_code == 403
    reviewer = await db_session.get(User, uuid.UUID(seeded["userId"]))
    assert reviewer is not None
    assert reviewer.edu_email == DEFAULT_REVIEWER_ORG_EMAIL
    assert reviewer.pending_edu_email is None
    deleted = await purge_reviewer_org(db_session)
    assert deleted is True
    assert await db_session.get(User, reviewer.id) is None


async def test_reviewer_connect_does_not_dismiss_other_org_suggestions(
    app_client: AsyncClient,
    fake_instagram: FakeInstagramClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    brand, drop = await _seed_drop(db_session)
    _enable(monkeypatch, drop.id)
    await _seed_via_api(app_client, db_session, drop.id)

    other = await persist(db_session, make_user(instagram_username="othercampus"))
    other_org = await make_org(db_session, other, org_name="Other Campus Org")
    linked_app = await make_application(
        db_session, drop, other_org, decision=ApplicationDecision.ACCEPTED
    )
    second_drop = await make_drop(db_session, brand, title="Second Campus Drop")
    other_app = await make_application(
        db_session, second_drop, other_org, decision=ApplicationDecision.ACCEPTED
    )
    post = await make_social_post(db_session, other_org, caption="hello @acmebrand")
    await make_post_link(db_session, post, linked_app)
    suggestion = PostCampaignSuggestion(
        post_id=post.id,
        application_id=other_app.id,
        match_reason=SuggestionMatchReason.BRAND_HANDLE_CAPTION.value,
        match_evidence="@acmebrand",
    )
    db_session.add(suggestion)
    await db_session.flush()

    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_scoped"
    fake_instagram.username = "scopedreviewer"
    start = await app_client.post("/api/meta-reviewer/start", json={"token": SECRET})
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "oauth-code", "state": _state_from(start)},
    )
    assert resp.status_code == 200, resp.text
    await db_session.refresh(suggestion)
    assert suggestion.dismissed_at is None
