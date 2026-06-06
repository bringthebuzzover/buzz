"""Pin the §3.2 hard database constraints.

Each test inserts a first row that succeeds, then attempts a second row
that violates a unique or check constraint, and asserts that the second
flush raises ``IntegrityError``. These tests exist specifically so a
future model edit that silently drops one of these constraints fails
loudly in CI.

The most important assertion is ``test_one_post_one_campaign``: the
PRODUCT.md §4.2 invariant "one post can belong to at most one campaign"
is encoded as ``UNIQUE(post_id)`` on ``post_campaign_links`` and is the
hard rule the entire attribution model depends on.

The ``db_session`` fixture (see ``conftest.py``) wraps each test in an
outer transaction with an inner SAVEPOINT, so an ``IntegrityError``
caught here only burns the savepoint — the connection stays usable for
the test's own assertions and rolls back fully at teardown.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Brand,
    Drop,
    DropApplication,
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


async def _seed_org_brand_drop_post(
    session: AsyncSession, suffix: str
) -> tuple[Organization, Brand, Drop, SocialPost, DropApplication]:
    """Helper to set up the parent rows the link/suggestion constraints need."""

    org_user = User(
        portal_role=PortalRole.ORG.value,
        status=OrgUserStatus.ACTIVE.value,
        instagram_user_id=f"ig_{suffix}",
        edu_email=f"{suffix}@uni.edu",
    )
    brand_user = User(
        portal_role=PortalRole.BRAND.value,
        status=OrgUserStatus.ACTIVE.value,
    )
    session.add_all([org_user, brand_user])
    await session.flush()

    org = Organization(
        user_id=org_user.id,
        org_name=f"Org {suffix}",
        university="Test U",
        edu_email=org_user.edu_email or f"{suffix}@uni.edu",
        instagram_handle=f"org_{suffix}",
    )
    brand = Brand(
        user_id=brand_user.id,
        brand_name=f"Brand {suffix}",
        company_email=f"brand_{suffix}@test.example",
        status=BrandStatus.APPROVED.value,
    )
    session.add_all([org, brand])
    await session.flush()

    drop = Drop(
        brand_id=brand.id,
        brand_name=brand.brand_name,
        title=f"Drop {suffix}",
        description="x",
        image="https://example.com/img.png",
        location="SF",
        capacity_total=5,
        apply_open_at=_now() - timedelta(days=1),
        apply_close_at=_now() + timedelta(days=1),
        manual_reopen=False,
        brand_tracker_stage=BrandTrackerStage.REQUEST_RECEIVED.value,
    )
    session.add(drop)
    await session.flush()

    app = DropApplication(
        drop_id=drop.id,
        org_id=org.id,
        decision=ApplicationDecision.ACCEPTED.value,
    )
    post = SocialPost(
        org_id=org.id,
        platform=Platform.INSTAGRAM.value,
        external_id=f"ig_post_{suffix}",
        url=f"https://instagram.com/p/{suffix}",
        caption="x",
        media_type=SocialMediaType.IMAGE.value,
        media_product_type=SocialMediaProductType.FEED.value,
        posted_at=_now(),
    )
    session.add_all([app, post])
    await session.flush()
    return org, brand, drop, post, app


@pytest.mark.asyncio
async def test_one_post_one_campaign(db_session: AsyncSession) -> None:
    """PRODUCT.md §4.2: a single post can belong to at most one campaign.

    Enforced by ``UNIQUE(post_id)`` on ``post_campaign_links``. This is the
    most important constraint in the schema and the reason every reattribution
    flow is allowed to be naive (just insert a new link after deleting the old).
    """

    _, _, drop, post, app = await _seed_org_brand_drop_post(db_session, "linkone")

    db_session.add(
        PostCampaignLink(
            post_id=post.id,
            application_id=app.id,
            drop_id=drop.id,
            source=PostLinkSource.ORG_MANUAL.value,
        )
    )
    await db_session.flush()

    db_session.add(
        PostCampaignLink(
            post_id=post.id,  # same post — must collide
            application_id=app.id,
            drop_id=drop.id,
            source=PostLinkSource.AUTO_SUGGESTED.value,
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


@pytest.mark.asyncio
async def test_notify_me_unique_org_drop(db_session: AsyncSession) -> None:
    """Each (org, drop) pair holds at most one notification preference."""

    org, _, drop, _, _ = await _seed_org_brand_drop_post(db_session, "notifyone")

    db_session.add(NotifyMe(org_id=org.id, drop_id=drop.id, reminder_minutes=15))
    await db_session.flush()

    db_session.add(NotifyMe(org_id=org.id, drop_id=drop.id, reminder_minutes=60))
    with pytest.raises(IntegrityError):
        await db_session.flush()


@pytest.mark.asyncio
async def test_drop_application_unique_active_blocks_duplicate(
    db_session: AsyncSession,
) -> None:
    """At most one non-denied application per (drop, org) (partial unique index)."""

    org, _, drop, _, _ = await _seed_org_brand_drop_post(db_session, "dupapp")
    # The helper already added one ACCEPTED (non-denied) application.
    db_session.add(
        DropApplication(
            drop_id=drop.id,
            org_id=org.id,
            decision=ApplicationDecision.APPLIED.value,
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


@pytest.mark.asyncio
async def test_drop_application_denied_coexists_with_active(
    db_session: AsyncSession,
) -> None:
    """A denied application doesn't count toward the active-uniqueness rule, so
    an org can re-apply after a denial (denied + non-denied rows coexist)."""

    org, _, drop, _, _ = await _seed_org_brand_drop_post(db_session, "denyok")
    # Helper added one ACCEPTED row; a DENIED row for the same (drop, org) is
    # outside the partial index predicate and must NOT raise.
    db_session.add(
        DropApplication(
            drop_id=drop.id,
            org_id=org.id,
            decision=ApplicationDecision.DENIED.value,
        )
    )
    await db_session.flush()  # no IntegrityError


@pytest.mark.asyncio
async def test_suggestion_unique_post_application(db_session: AsyncSession) -> None:
    """``post_campaign_suggestions`` is idempotent on (post_id, application_id)."""

    _, _, drop, post, app = await _seed_org_brand_drop_post(db_session, "sugone")

    db_session.add(
        PostCampaignSuggestion(
            post_id=post.id,
            application_id=app.id,
            drop_id=drop.id,
            match_reason=SuggestionMatchReason.BRAND_HANDLE_CAPTION.value,
            match_evidence="@brand",
        )
    )
    await db_session.flush()

    db_session.add(
        PostCampaignSuggestion(
            post_id=post.id,
            application_id=app.id,
            drop_id=drop.id,
            match_reason=SuggestionMatchReason.CAMPAIGN_HASHTAG.value,
            match_evidence="#brandtag",
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


@pytest.mark.asyncio
async def test_users_unique_instagram_user_id(db_session: AsyncSession) -> None:
    """One Buzz account per Instagram identity."""

    db_session.add(
        User(
            portal_role=PortalRole.ORG.value,
            status=OrgUserStatus.ACTIVE.value,
            instagram_user_id="ig_duplicate",
        )
    )
    await db_session.flush()

    db_session.add(
        User(
            portal_role=PortalRole.ORG.value,
            status=OrgUserStatus.ACTIVE.value,
            instagram_user_id="ig_duplicate",
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


@pytest.mark.asyncio
async def test_users_unique_edu_email_allows_multiple_nulls(
    db_session: AsyncSession,
) -> None:
    """``edu_email`` is unique when present but NULL repeats freely.

    Brand and admin rows have no ``.edu`` email, and PostgreSQL's default
    NULL handling in unique indexes allows multiple NULL values — verify
    both behaviours in one test so a future "set NULLs distinct" change
    fails loudly.
    """

    db_session.add_all(
        [
            User(
                portal_role=PortalRole.BRAND.value,
                status=OrgUserStatus.ACTIVE.value,
                edu_email=None,
            ),
            User(
                portal_role=PortalRole.BRAND.value,
                status=OrgUserStatus.ACTIVE.value,
                edu_email=None,
            ),
            User(
                portal_role=PortalRole.ORG.value,
                status=OrgUserStatus.ACTIVE.value,
                instagram_user_id="ig_edu_a",
                edu_email="dup@uni.edu",
            ),
        ]
    )
    await db_session.flush()

    db_session.add(
        User(
            portal_role=PortalRole.ORG.value,
            status=OrgUserStatus.ACTIVE.value,
            instagram_user_id="ig_edu_b",
            edu_email="dup@uni.edu",
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


@pytest.mark.asyncio
async def test_social_posts_unique_platform_external_id(
    db_session: AsyncSession,
) -> None:
    """Repeated ``/me/media`` syncs must not create duplicate rows."""

    org, _, _, _, _ = await _seed_org_brand_drop_post(db_session, "postuniq")

    db_session.add(
        SocialPost(
            org_id=org.id,
            platform=Platform.INSTAGRAM.value,
            external_id="ig_dup_external",
            url="https://instagram.com/p/dup1",
            caption="x",
            media_type=SocialMediaType.IMAGE.value,
            media_product_type=SocialMediaProductType.FEED.value,
            posted_at=_now(),
        )
    )
    await db_session.flush()

    db_session.add(
        SocialPost(
            org_id=org.id,
            platform=Platform.INSTAGRAM.value,
            external_id="ig_dup_external",  # same (platform, external_id)
            url="https://instagram.com/p/dup2",
            caption="x",
            media_type=SocialMediaType.IMAGE.value,
            media_product_type=SocialMediaProductType.FEED.value,
            posted_at=_now(),
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


@pytest.mark.asyncio
async def test_pg_enum_rejects_invalid_value(db_session: AsyncSession) -> None:
    """PG ENUM types reject any value outside their declared members.

    Inserting via raw SQL (bypassing the SQLAlchemy enum coercion) proves
    the rejection happens at the database layer — not just in Python. The
    error surfaces as ``DBAPIError`` rather than ``IntegrityError`` because
    asyncpg classifies invalid enum input as ``InvalidTextRepresentation``.
    """

    bogus_id = uuid.uuid4()
    with pytest.raises(DBAPIError):
        await db_session.execute(
            text(
                "INSERT INTO users (id, portal_role, status) "
                "VALUES (:id, 'not_a_real_role', 'active')"
            ),
            {"id": bogus_id},
        )
        await db_session.flush()
