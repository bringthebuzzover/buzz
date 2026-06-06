"""Idempotent local dev seed for the Buzz backend.

Replaces the conceptual role of the demo's ``src/data/seed/seed*.ts`` files
for local API development. Just enough rows to exercise the Stage 4 vertical
slice; production data comes from real onboarding flows.

Strategy
--------
* **Destructive TRUNCATE** of every domain table (predictable starting state).
  Enum types are kept; only row data is wiped. ``RESTART IDENTITY CASCADE``
  resets any future sequences and cascades through FKs in one statement.
* **Localhost guard** — refuses to run if ``DATABASE_URL`` points at anything
  other than ``localhost`` / ``127.0.0.1`` (or an empty host, i.e. a UNIX
  socket). Calling this against a remote/Prod DB would wipe it; that should
  never be a one-line accident.
* Stable seed UUIDs (``uuid.UUID(int=N)``) — predictable IDs make the next
  stages easier to write tests/curl scripts against.

Usage
-----

::

    cd backend
    poetry run python scripts/seed_dev.py
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

# Make ``app`` importable when the script is invoked from anywhere
# (``python scripts/seed_dev.py`` shells use ``backend/`` as CWD; CI or an
# absolute path invocation does not). Resolves to the ``backend/`` root.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import select, text  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker  # noqa: E402

from app.config import settings  # noqa: E402
from app.deps.db import engine  # noqa: E402
from app.security.password import hash_password  # noqa: E402
from app.security.token_crypto import encrypt_token  # noqa: E402

# Dev brand-login password for seeded brands (real bcrypt hash so brand login is
# exercisable locally and won't 500 on a placeholder). Both seed brands use it.
_DEV_BRAND_PASSWORD = "buzzdev123"
from app.models import (  # noqa: E402
    Base,
    Brand,
    Drop,
    DropApplication,
    DropTrackerEvent,
    NotifyMe,
    Organization,
    PostCampaignLink,
    PostCampaignSuggestion,
    SocialPost,
    User,
    Waitlist,
)
from app.models.enums import (  # noqa: E402
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
    WaitlistEntityType,
)

LOCAL_HOSTS = {"localhost", "127.0.0.1", ""}


def _assert_local(database_url: str) -> None:
    """Refuse to run against any DB that is not unambiguously local."""

    parsed = urlparse(database_url.replace("postgresql+asyncpg://", "postgresql://"))
    host = (parsed.hostname or "").lower()
    if host not in LOCAL_HOSTS:
        print(
            f"refusing to seed: DATABASE_URL host '{host}' is not local. "
            "Seed is destructive (TRUNCATE) — only run against localhost.",
            file=sys.stderr,
        )
        raise SystemExit(2)


def _uuid(n: int) -> uuid.UUID:
    """Stable UUID helper so seed IDs are predictable across runs."""

    return uuid.UUID(int=n)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _truncate(session: AsyncSession) -> None:
    """Wipe every domain table in one transaction.

    ``CASCADE`` walks FKs (so order doesn't matter) and ``RESTART IDENTITY``
    resets any sequences we may add later.
    """

    table_names = ", ".join(t.name for t in Base.metadata.sorted_tables)
    await session.execute(text(f"TRUNCATE {table_names} RESTART IDENTITY CASCADE"))


def _build_seed_rows() -> dict[str, list[Base]]:
    now = _now()

    # --- Users -------------------------------------------------------------
    admin = User(
        id=_uuid(1),
        portal_role=PortalRole.ADMIN.value,
        status=OrgUserStatus.ACTIVE.value,
        edu_email=None,
        instagram_user_id=None,
        instagram_username=None,
    )
    org_user_active = User(
        id=_uuid(2),
        portal_role=PortalRole.ORG.value,
        status=OrgUserStatus.ACTIVE.value,
        instagram_user_id="ig_seed_org_active",
        instagram_username="berkeleyrowing",
        # Long-lived IG token is encrypted at rest (architecture.md §10.5), so
        # seed data mirrors the real OAuth write path and Stage 8 decrypt works.
        instagram_access_token=encrypt_token("seed-long-lived-token-active"),
        instagram_token_issued_at=now,
        instagram_token_expires_at=now + timedelta(days=60),
        instagram_token_refreshed_at=now,
        edu_email="active-org@berkeley.edu",
        email_verified_at=now,
    )
    org_user_pending = User(
        id=_uuid(3),
        portal_role=PortalRole.ORG.value,
        status=OrgUserStatus.PENDING_APPROVAL.value,
        instagram_user_id="ig_seed_org_pending",
        instagram_username="stanfordhackers",
        instagram_access_token=encrypt_token("seed-long-lived-token-pending"),
        instagram_token_issued_at=now,
        instagram_token_expires_at=now + timedelta(days=60),
        instagram_token_refreshed_at=now,
        edu_email="pending-org@stanford.edu",
        email_verified_at=now,
    )
    # Just completed Instagram OAuth but has not submitted a profile yet
    # (architecture.md §3.4 Phase 1 end state). No ``organizations`` row.
    org_user_onboarding = User(
        id=_uuid(6),
        portal_role=PortalRole.ORG.value,
        status=OrgUserStatus.PENDING_ORG_PROFILE.value,
        instagram_user_id="ig_seed_org_onboarding",
        instagram_username="uclasailing",
        instagram_access_token=encrypt_token("seed-long-lived-token-onboarding"),
        instagram_token_issued_at=now,
        instagram_token_expires_at=now + timedelta(days=60),
        instagram_token_refreshed_at=now,
    )
    brand_user_1 = User(
        id=_uuid(4),
        portal_role=PortalRole.BRAND.value,
        status=OrgUserStatus.ACTIVE.value,
        password_hash=hash_password(_DEV_BRAND_PASSWORD),
    )
    brand_user_2 = User(
        id=_uuid(5),
        portal_role=PortalRole.BRAND.value,
        status=OrgUserStatus.ACTIVE.value,
        password_hash=hash_password(_DEV_BRAND_PASSWORD),
    )

    # --- Organizations -----------------------------------------------------
    org_active = Organization(
        id=_uuid(10),
        user_id=org_user_active.id,
        org_name="Berkeley Rowing Club",
        university="UC Berkeley",
        edu_email=org_user_active.edu_email or "active-org@berkeley.edu",
        instagram_handle="berkeleyrowing",
        follower_count=4200,
        member_count=85,
        city="Berkeley",
        state="CA",
        contact_name="Avery Lin",
        delivery_address="2301 Bancroft Way, Berkeley, CA 94720",
        approved_at=now,
    )
    org_pending = Organization(
        id=_uuid(11),
        user_id=org_user_pending.id,
        org_name="Stanford Hackers",
        university="Stanford University",
        edu_email=org_user_pending.edu_email or "pending-org@stanford.edu",
        instagram_handle="stanfordhackers",
        follower_count=1100,
        member_count=42,
        city="Stanford",
        state="CA",
    )

    # --- Brands ------------------------------------------------------------
    brand_a = Brand(
        id=_uuid(20),
        user_id=brand_user_1.id,
        brand_name="Acme Coffee",
        company_email="partnerships@acme.coffee",
        instagram_handle="acmecoffee",
        status=BrandStatus.APPROVED.value,
        approved_at=now,
    )
    brand_b = Brand(
        id=_uuid(21),
        user_id=brand_user_2.id,
        brand_name="Northwind Apparel",
        company_email="brand@northwind.example",
        instagram_handle="northwindapparel",
        status=BrandStatus.APPROVED.value,
        approved_at=now,
    )

    # --- Drops -------------------------------------------------------------
    drop_brief = Drop(
        id=_uuid(30),
        brand_id=brand_a.id,
        brand_name=brand_a.brand_name,
        title="Fall Cold Brew Launch",
        description="200 cans of single-origin cold brew for fall rush events.",
        image="https://placehold.co/600x400/png",
        location="Bay Area",
        capacity_total=10,
        apply_open_at=now - timedelta(days=7),
        apply_close_at=now + timedelta(days=7),
        manual_reopen=False,
        brand_tracker_stage=BrandTrackerStage.REQUEST_RECEIVED.value,
        total_product_units=200,
        campaign_hashtag="AcmeFallBrew",
    )
    drop_review = Drop(
        id=_uuid(31),
        brand_id=brand_a.id,
        brand_name=brand_a.brand_name,
        title="Spring Espresso Sampler",
        description="Espresso pucks + branded mugs for hosted tasting events.",
        image="https://placehold.co/600x400/png",
        location="LA + SF",
        capacity_total=6,
        apply_open_at=now - timedelta(days=3),
        apply_close_at=now + timedelta(days=14),
        manual_reopen=False,
        brand_tracker_stage=BrandTrackerStage.FINALIZING_AGREEMENTS.value,
        total_product_units=None,
    )
    drop_shipped = Drop(
        id=_uuid(32),
        brand_id=brand_b.id,
        brand_name=brand_b.brand_name,
        title="Game Day Hoodies",
        description="Branded hoodies for collegiate game-day giveaways.",
        image="https://placehold.co/600x400/png",
        location="National",
        capacity_total=20,
        apply_open_at=now - timedelta(days=30),
        apply_close_at=now - timedelta(days=5),
        manual_reopen=False,
        brand_tracker_stage=BrandTrackerStage.AWAITING_PRODUCTS.value,
        tracking_number="NW-TRK-001",
        total_product_units=400,
        campaign_hashtag="NorthwindGameDay",
        applicant_selection_finalized_at=now - timedelta(days=6),
    )
    drop_finished = Drop(
        id=_uuid(33),
        brand_id=brand_b.id,
        brand_name=brand_b.brand_name,
        title="Summer Tote Drop",
        description="Limited canvas totes for summer orientation events.",
        image="https://placehold.co/600x400/png",
        location="National",
        capacity_total=15,
        apply_open_at=now - timedelta(days=120),
        apply_close_at=now - timedelta(days=90),
        manual_reopen=False,
        brand_tracker_stage=BrandTrackerStage.DROP_FINISHED.value,
        total_product_units=300,
        applicant_selection_finalized_at=now - timedelta(days=89),
    )

    # --- Drop applications -------------------------------------------------
    app_accepted = DropApplication(
        id=_uuid(40),
        drop_id=drop_shipped.id,
        org_id=org_active.id,
        decision=ApplicationDecision.ACCEPTED.value,
        pitch="Bay Area rowing crew with 4k engaged followers.",
        allocated_units=40,
        applied_at=now - timedelta(days=25),
        decision_at=now - timedelta(days=6),
    )
    app_accepted_finished = DropApplication(
        id=_uuid(41),
        drop_id=drop_finished.id,
        org_id=org_active.id,
        decision=ApplicationDecision.ACCEPTED.value,
        allocated_units=30,
        applied_at=now - timedelta(days=110),
        decision_at=now - timedelta(days=89),
    )
    app_applied = DropApplication(
        id=_uuid(42),
        drop_id=drop_brief.id,
        org_id=org_active.id,
        decision=ApplicationDecision.APPLIED.value,
        pitch="Repeat partner — strong cold-brew demo audience.",
        applied_at=now - timedelta(days=2),
    )
    app_applied_review = DropApplication(
        id=_uuid(43),
        drop_id=drop_review.id,
        org_id=org_active.id,
        decision=ApplicationDecision.APPLIED.value,
        applied_at=now - timedelta(days=1),
    )
    app_denied = DropApplication(
        id=_uuid(44),
        drop_id=drop_brief.id,
        org_id=org_pending.id,
        decision=ApplicationDecision.DENIED.value,
        applied_at=now - timedelta(days=2),
        decision_at=now - timedelta(hours=12),
    )
    app_pending_org = DropApplication(
        id=_uuid(45),
        drop_id=drop_review.id,
        org_id=org_pending.id,
        decision=ApplicationDecision.APPLIED.value,
        applied_at=now - timedelta(hours=6),
    )

    # --- Social posts (org_active) -----------------------------------------
    post_reels = SocialPost(
        id=_uuid(50),
        org_id=org_active.id,
        platform=Platform.INSTAGRAM.value,
        external_id="ig_seed_reels_1",
        url="https://instagram.com/reel/seed1",
        caption="Loving the new @acmecoffee cold brew — perfect for #AcmeFallBrew season!",
        media_type=SocialMediaType.VIDEO.value,
        media_product_type=SocialMediaProductType.REELS.value,
        posted_at=now - timedelta(days=4),
        likes=820,
        comments=53,
        views=12400,
        reels_skip_rate=0.18,
        metrics_updated_at=now,
    )
    post_feed = SocialPost(
        id=_uuid(51),
        org_id=org_active.id,
        platform=Platform.INSTAGRAM.value,
        external_id="ig_seed_feed_1",
        url="https://instagram.com/p/seed2",
        caption="Morning workout fuel courtesy of @acmecoffee",
        media_type=SocialMediaType.IMAGE.value,
        media_product_type=SocialMediaProductType.FEED.value,
        posted_at=now - timedelta(days=10),
        likes=410,
        comments=22,
        metrics_updated_at=now,
    )
    post_unlinked = SocialPost(
        id=_uuid(52),
        org_id=org_active.id,
        platform=Platform.INSTAGRAM.value,
        external_id="ig_seed_feed_2",
        url="https://instagram.com/p/seed3",
        caption="Sunset row on the bay.",
        media_type=SocialMediaType.CAROUSEL_ALBUM.value,
        media_product_type=SocialMediaProductType.FEED.value,
        posted_at=now - timedelta(days=1),
        likes=190,
        comments=8,
    )

    # --- Links & suggestions ----------------------------------------------
    link = PostCampaignLink(
        id=_uuid(60),
        post_id=post_reels.id,
        application_id=app_accepted.id,
        drop_id=app_accepted.drop_id,
        source=PostLinkSource.ORG_MANUAL.value,
        linked_at=now - timedelta(days=3),
    )
    suggestion = PostCampaignSuggestion(
        id=_uuid(70),
        post_id=post_feed.id,
        application_id=app_accepted.id,
        drop_id=app_accepted.drop_id,
        match_reason=SuggestionMatchReason.BRAND_HANDLE_CAPTION.value,
        match_evidence="@acmecoffee",
    )

    tracker_brief = DropTrackerEvent(
        id=_uuid(80),
        drop_id=drop_brief.id,
        stage=BrandTrackerStage.REQUEST_RECEIVED.value,
        note="Drop created — request received.",
        occurred_at=drop_brief.apply_open_at,
    )

    notify = NotifyMe(
        id=_uuid(90),
        org_id=org_active.id,
        drop_id=drop_review.id,
        reminder_minutes=15,
        enabled=True,
    )

    waitlist_brand = Waitlist(
        id=_uuid(100),
        submitter_name="Sam Casey",
        entity_name="Forge Beverages",
        email="sam@forge.example",
        entity_type=WaitlistEntityType.BRAND.value,
        details="Interested in fall campus pilots.",
    )

    return {
        "users": [
            admin,
            org_user_active,
            org_user_pending,
            org_user_onboarding,
            brand_user_1,
            brand_user_2,
        ],
        "organizations": [org_active, org_pending],
        "brands": [brand_a, brand_b],
        "drops": [drop_brief, drop_review, drop_shipped, drop_finished],
        "drop_applications": [
            app_accepted,
            app_accepted_finished,
            app_applied,
            app_applied_review,
            app_denied,
            app_pending_org,
        ],
        "social_posts": [post_reels, post_feed, post_unlinked],
        "post_campaign_links": [link],
        "post_campaign_suggestions": [suggestion],
        "drop_tracker_events": [tracker_brief],
        "notify_me": [notify],
        "waitlist": [waitlist_brand],
    }


async def _seed() -> None:
    _assert_local(settings.DATABASE_URL)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        await _truncate(session)

        rows_by_table = _build_seed_rows()
        # Insertion order matters because of FKs (users before orgs/brands,
        # orgs/brands before drops/applications, etc.). ``sorted_tables``
        # gives us topological order; flush after each batch so the next
        # table's FK lookups see the parent rows.
        for table in Base.metadata.sorted_tables:
            batch = rows_by_table.get(table.name, [])
            if not batch:
                continue
            session.add_all(batch)
            await session.flush()

        await session.commit()

        summary_parts: list[str] = []
        for table in Base.metadata.sorted_tables:
            count = await session.scalar(select(text("count(*)")).select_from(table))
            summary_parts.append(f"{table.name}: {count}")
        print("seed complete -> " + "  ".join(summary_parts))
        # Print an active org user id so a dev JWT can be minted for /me
        # (see the Stage 3 guide for the one-liner).
        print(f"active org user id (mint a token for /api/auth/me): {_uuid(2)}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(_seed())
