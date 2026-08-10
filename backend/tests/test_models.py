"""Round-trip every ORM model.

For each top-level aggregate: insert a fully-populated row, flush, fetch
by PK, and assert on a handful of representative fields. Goal is "mappings
compile and survive a Python ↔ PG round-trip" — exhaustive business logic
lives in later stages.

Each test creates whatever parent rows it needs inline rather than sharing
fixtures so failures stay self-contained and easy to read.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Brand,
    Drop,
    DropApplication,
    DropTrackerEvent,
    EmailVerificationToken,
    NotifyMe,
    Organization,
    PostCampaignLink,
    PostCampaignSuggestion,
    SocialPost,
    User,
)
from app.models.enums import (
    ApplicationDecision,
    BrandStatus,
    BrandTrackerStage,
    OrgUserStatus,
    Platform,
    PortalRole,
    PostLinkSource,
    SocialMediaProductType,
    SocialMediaType,
    SuggestionMatchReason,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _make_org_user(session: AsyncSession, ig_id: str = "ig_x") -> User:
    user = User(
        portal_role=PortalRole.ORG.value,
        status=OrgUserStatus.ACTIVE.value,
        instagram_user_id=ig_id,
        instagram_username=ig_id,
        edu_email=f"{ig_id}@uni.edu",
        email_verified_at=_now(),
    )
    session.add(user)
    await session.flush()
    return user


async def _make_brand_user(session: AsyncSession) -> User:
    user = User(
        portal_role=PortalRole.BRAND.value,
        status=OrgUserStatus.ACTIVE.value,
        password_hash="$argon2id$placeholder",
    )
    session.add(user)
    await session.flush()
    return user


async def _make_org(session: AsyncSession, suffix: str = "x") -> Organization:
    user = await _make_org_user(session, ig_id=f"ig_{suffix}")
    org = Organization(
        user_id=user.id,
        org_name=f"Org {suffix}",
        university="Test U",
    )
    session.add(org)
    await session.flush()
    return org


async def _make_brand(session: AsyncSession) -> Brand:
    user = await _make_brand_user(session)
    brand = Brand(
        user_id=user.id,
        brand_name="Test Brand",
        company_email="brand@test.example",
        instagram_handle="testbrand",
        status=BrandStatus.APPROVED.value,
    )
    session.add(brand)
    await session.flush()
    return brand


async def _make_drop(session: AsyncSession) -> Drop:
    brand = await _make_brand(session)
    now = _now()
    drop = Drop(
        brand_id=brand.id,
        title="Test Drop",
        description="desc",
        image="https://example.com/img.png",
        location="SF",
        capacity_total=5,
        apply_open_at=now - timedelta(days=1),
        apply_close_at=now + timedelta(days=1),
        manual_reopen=False,
        brand_tracker_stage=BrandTrackerStage.REQUEST_RECEIVED.value,
    )
    session.add(drop)
    await session.flush()
    return drop


@pytest.mark.asyncio
async def test_user_roundtrip(db_session: AsyncSession) -> None:
    user = User(
        portal_role=PortalRole.ORG.value,
        status=OrgUserStatus.ACTIVE.value,
        instagram_user_id="ig_user_rt",
        instagram_username="user_rt",
        edu_email="user_rt@uni.edu",
    )
    db_session.add(user)
    await db_session.flush()

    fetched = await db_session.scalar(select(User).where(User.id == user.id))
    assert fetched is not None
    assert fetched.instagram_user_id == "ig_user_rt"
    assert fetched.portal_role == PortalRole.ORG.value
    assert fetched.status == OrgUserStatus.ACTIVE.value
    assert fetched.password_hash is None  # nullable; brand auth lives in Stage 3
    assert fetched.created_at is not None  # server_default applied


@pytest.mark.asyncio
async def test_organization_roundtrip(db_session: AsyncSession) -> None:
    org = await _make_org(db_session, suffix="rt")
    fetched = await db_session.scalar(select(Organization).where(Organization.id == org.id))
    assert fetched is not None
    assert fetched.org_name == "Org rt"
    assert fetched.university == "Test U"


@pytest.mark.asyncio
async def test_brand_roundtrip(db_session: AsyncSession) -> None:
    brand = await _make_brand(db_session)
    fetched = await db_session.scalar(select(Brand).where(Brand.id == brand.id))
    assert fetched is not None
    assert fetched.brand_name == "Test Brand"
    assert fetched.status == BrandStatus.APPROVED.value


@pytest.mark.asyncio
async def test_drop_roundtrip(db_session: AsyncSession) -> None:
    drop = await _make_drop(db_session)
    fetched = await db_session.scalar(select(Drop).where(Drop.id == drop.id))
    assert fetched is not None
    assert fetched.title == "Test Drop"
    assert fetched.brand_tracker_stage == BrandTrackerStage.REQUEST_RECEIVED.value
    assert fetched.total_product_units is None  # nullable for spot-only drops


@pytest.mark.asyncio
async def test_drop_application_roundtrip(db_session: AsyncSession) -> None:
    drop = await _make_drop(db_session)
    org = await _make_org(db_session, suffix="apprt")
    app = DropApplication(
        drop_id=drop.id,
        org_id=org.id,
        decision=ApplicationDecision.APPLIED.value,
        pitch="we love this brand",
    )
    db_session.add(app)
    await db_session.flush()

    fetched = await db_session.scalar(select(DropApplication).where(DropApplication.id == app.id))
    assert fetched is not None
    assert fetched.decision == ApplicationDecision.APPLIED.value
    assert fetched.pitch == "we love this brand"
    assert fetched.allocated_units is None


@pytest.mark.asyncio
async def test_social_post_roundtrip(db_session: AsyncSession) -> None:
    org = await _make_org(db_session, suffix="postrt")
    post = SocialPost(
        org_id=org.id,
        platform=Platform.INSTAGRAM.value,
        external_id="ig_post_rt",
        url="https://instagram.com/p/abc",
        caption="caption",
        media_type=SocialMediaType.VIDEO.value,
        media_product_type=SocialMediaProductType.REELS.value,
        posted_at=_now(),
        likes=10,
        comments=2,
        reels_skip_rate=0.42,
        insights_raw={"impressions": 1000, "reach": 800},
    )
    db_session.add(post)
    await db_session.flush()

    fetched = await db_session.scalar(select(SocialPost).where(SocialPost.id == post.id))
    assert fetched is not None
    assert fetched.platform == Platform.INSTAGRAM.value
    assert fetched.media_product_type == SocialMediaProductType.REELS.value
    assert fetched.reels_skip_rate == pytest.approx(0.42)
    assert fetched.insights_raw == {"impressions": 1000, "reach": 800}
    assert fetched.metrics_updated_at is None


@pytest.mark.asyncio
async def test_post_campaign_link_roundtrip(db_session: AsyncSession) -> None:
    drop = await _make_drop(db_session)
    org = await _make_org(db_session, suffix="linkrt")
    app = DropApplication(
        drop_id=drop.id,
        org_id=org.id,
        decision=ApplicationDecision.ACCEPTED.value,
    )
    post = SocialPost(
        org_id=org.id,
        platform=Platform.INSTAGRAM.value,
        external_id="ig_post_link_rt",
        url="https://instagram.com/p/x",
        caption="x",
        media_type=SocialMediaType.IMAGE.value,
        media_product_type=SocialMediaProductType.FEED.value,
        posted_at=_now(),
    )
    db_session.add_all([app, post])
    await db_session.flush()

    link = PostCampaignLink(
        post_id=post.id,
        application_id=app.id,
        source=PostLinkSource.ORG_MANUAL.value,
    )
    db_session.add(link)
    await db_session.flush()

    fetched = await db_session.scalar(
        select(PostCampaignLink).where(PostCampaignLink.id == link.id)
    )
    assert fetched is not None
    assert fetched.source == PostLinkSource.ORG_MANUAL.value


@pytest.mark.asyncio
async def test_post_campaign_suggestion_roundtrip(db_session: AsyncSession) -> None:
    drop = await _make_drop(db_session)
    org = await _make_org(db_session, suffix="sugrt")
    app = DropApplication(
        drop_id=drop.id, org_id=org.id, decision=ApplicationDecision.APPLIED.value
    )
    post = SocialPost(
        org_id=org.id,
        platform=Platform.INSTAGRAM.value,
        external_id="ig_post_sug_rt",
        url="https://instagram.com/p/y",
        caption="@testbrand looks great",
        media_type=SocialMediaType.IMAGE.value,
        media_product_type=SocialMediaProductType.FEED.value,
        posted_at=_now(),
    )
    db_session.add_all([app, post])
    await db_session.flush()

    suggestion = PostCampaignSuggestion(
        post_id=post.id,
        application_id=app.id,
        match_reason=SuggestionMatchReason.BRAND_HANDLE_CAPTION.value,
        match_evidence="@testbrand",
    )
    db_session.add(suggestion)
    await db_session.flush()

    fetched = await db_session.scalar(
        select(PostCampaignSuggestion).where(PostCampaignSuggestion.id == suggestion.id)
    )
    assert fetched is not None
    assert fetched.match_reason == SuggestionMatchReason.BRAND_HANDLE_CAPTION.value
    assert fetched.confirmed_at is None and fetched.dismissed_at is None


@pytest.mark.asyncio
async def test_drop_tracker_event_roundtrip(db_session: AsyncSession) -> None:
    drop = await _make_drop(db_session)
    event_row = DropTrackerEvent(
        drop_id=drop.id,
        stage=BrandTrackerStage.AWAITING_PRODUCTS.value,
        note="handed to courier",
    )
    db_session.add(event_row)
    await db_session.flush()

    fetched = await db_session.scalar(
        select(DropTrackerEvent).where(DropTrackerEvent.id == event_row.id)
    )
    assert fetched is not None
    assert fetched.stage == BrandTrackerStage.AWAITING_PRODUCTS.value


@pytest.mark.asyncio
async def test_notify_me_roundtrip(db_session: AsyncSession) -> None:
    drop = await _make_drop(db_session)
    org = await _make_org(db_session, suffix="notify")
    notify = NotifyMe(
        org_id=org.id,
        drop_id=drop.id,
        reminder_minutes=15,
        enabled=True,
    )
    db_session.add(notify)
    await db_session.flush()

    fetched = await db_session.scalar(select(NotifyMe).where(NotifyMe.id == notify.id))
    assert fetched is not None
    assert fetched.reminder_minutes == 15
    assert fetched.enabled is True


@pytest.mark.asyncio
async def test_email_verification_token_roundtrip(db_session: AsyncSession) -> None:
    user = await _make_org_user(db_session, ig_id="ig_email_token")
    token = EmailVerificationToken(
        user_id=user.id,
        token=uuid.uuid4().hex,
        email=user.edu_email or "x@uni.edu",
        expires_at=_now() + timedelta(hours=1),
    )
    db_session.add(token)
    await db_session.flush()

    fetched = await db_session.scalar(
        select(EmailVerificationToken).where(EmailVerificationToken.id == token.id)
    )
    assert fetched is not None
    assert fetched.used_at is None
