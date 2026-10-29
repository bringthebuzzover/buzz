"""Idempotent dev seed for the Buzz backend.

Replaces the conceptual role of the demo's ``src/data/seed/seed*.ts`` files
for local API development. Just enough rows to exercise the Stage 4 vertical
slice; production data comes from real onboarding flows.

Strategy
--------
* **Local (default)** — destructive ``TRUNCATE`` of every domain table, then
  the fixture set below. Refuses to run unless ``DATABASE_URL`` is
  ``localhost`` / ``127.0.0.1`` (or an empty host, i.e. a UNIX socket) and
  ``ENVIRONMENT`` is not ``production``.
* **Staging demo** — non-destructive upsert of obviously fake rows (Sample
  Org, Sample Club, Sample Brand, Fall Cold Brew Launch). Runs only when
  ``ENVIRONMENT=staging`` and ``STAGING_SEED_CONFIRM=buzz-staging``. Never
  truncates. Refuses ``ENVIRONMENT=production``, any host listed in
  ``PROD_DATABASE_HOSTS``, and a ``FRONTEND_URL`` whose host is
  ``bringthebuzzover.com`` or ``www.bringthebuzzover.com``. Manual one-off
  (``railway run``), not preDeploy.
* Stable seed UUIDs (``uuid.UUID(int=N)``).

Usage
-----

::

    cd backend
    poetry run python scripts/seed_dev.py

    # Staging only. STAGING_DEMO_PASSWORD is the Sample Brand login password.
    ENVIRONMENT=staging STAGING_SEED_CONFIRM=buzz-staging \\
        STAGING_DEMO_PASSWORD=... PROD_DATABASE_HOSTS=... \\
        poetry run python scripts/seed_dev.py
"""

from __future__ import annotations

import asyncio
import os
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
    DropApplicationShipment,
    DropRequest,
    DropTrackerEvent,
    NotifyMe,
    Organization,
    PostCampaignLink,
    PostCampaignSuggestion,
    SocialPost,
    User,
)
from app.models.enums import (  # noqa: E402
    ApplicationDecision,
    BrandStatus,
    BrandTrackerStage,
    OrgCategory,
    OrgUserStatus,
    Platform,
    PortalRole,
    PostLinkSource,
    SocialMediaProductType,
    SocialMediaType,
    SuggestionMatchReason,
)

LOCAL_HOSTS = {"localhost", "127.0.0.1", ""}
STAGING_SEED_CONFIRM = "buzz-staging"
# Apex production SPA only. staging.bringthebuzzover.com is a different host.
PROD_FRONTEND_HOSTS = {"bringthebuzzover.com", "www.bringthebuzzover.com"}

# Stable ids, clear of the local fixture range (1..100) and test accounts (9001..).
_SAMPLE_ORG_USER = uuid.UUID(int=8101)
_SAMPLE_CLUB_USER = uuid.UUID(int=8102)
_SAMPLE_BRAND_USER = uuid.UUID(int=8103)
_SAMPLE_ORG = uuid.UUID(int=8110)
_SAMPLE_CLUB = uuid.UUID(int=8111)
_SAMPLE_BRAND = uuid.UUID(int=8120)
_SAMPLE_DROP = uuid.UUID(int=8130)
_SAMPLE_APP_ORG = uuid.UUID(int=8140)
_SAMPLE_APP_CLUB = uuid.UUID(int=8141)


def _db_host(database_url: str) -> str:
    parsed = urlparse(database_url.replace("postgresql+asyncpg://", "postgresql://"))
    return (parsed.hostname or "").lower()


def prod_db_hosts_from_env(raw: str | None = None) -> set[str]:
    """Hostnames the staging demo must never touch.

    ``postgres.railway.internal`` is the same name inside every Railway
    project, so it is not a production identifier. Set ``PROD_DATABASE_HOSTS``
    to the production database hostname(s) before running the demo seed.
    """

    if raw is None:
        raw = os.environ.get("PROD_DATABASE_HOSTS", "")
    return {part.strip().lower() for part in raw.split(",") if part.strip()}


def _frontend_host(frontend_url: str) -> str:
    return (urlparse(frontend_url).hostname or "").lower()


def resolve_seed_mode(
    database_url: str,
    *,
    environment: str,
    confirm: str,
    prod_hosts: set[str],
    frontend_url: str,
) -> str:
    """Return ``local`` (truncate) or ``staging`` (demo upsert).

    ``SystemExit(2)`` on production, a denylisted database host, a production
    SPA host, or a remote database without the staging opt-in.
    """

    host = _db_host(database_url)
    if environment == "production":
        print("refusing to seed: ENVIRONMENT=production.", file=sys.stderr)
        raise SystemExit(2)
    if host and host in prod_hosts:
        print(
            f"refusing to seed: DATABASE_URL host '{host}' is listed in PROD_DATABASE_HOSTS.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    spa_host = _frontend_host(frontend_url)
    if spa_host in PROD_FRONTEND_HOSTS:
        print(
            f"refusing to seed: FRONTEND_URL host '{spa_host}' is production.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    if environment == "staging" and confirm == STAGING_SEED_CONFIRM:
        return "staging"
    if host in LOCAL_HOSTS:
        return "local"
    print(
        f"refusing to seed: DATABASE_URL host '{host}' is not local. "
        "The staging demo requires ENVIRONMENT=staging and "
        f"STAGING_SEED_CONFIRM={STAGING_SEED_CONFIRM}. Production is never seeded.",
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
        follower_count=4200,
        member_count=85,
        category=OrgCategory.SPORTS.value,
        city="Berkeley",
        state="CA",
        contact_name="Avery Lin",
        delivery_address="2301 Bancroft Way, Berkeley, CA 94720",
        shipping_line1="2301 Bancroft Way",
        shipping_city="Berkeley",
        shipping_state="CA",
        shipping_postal_code="94720",
        approved_at=now,
        claimed_instagram_username="berkeleyrowing",
    )
    org_pending = Organization(
        id=_uuid(11),
        user_id=org_user_pending.id,
        org_name="Stanford Hackers",
        university="Stanford University",
        follower_count=1100,
        member_count=42,
        category=OrgCategory.ACADEMIC.value,
        city="Stanford",
        state="CA",
        claimed_instagram_username="stanfordhackers",
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

    # --- Drop requests (intake tickets) ------------------------------------
    request_e2e = DropRequest(
        id=_uuid(25),
        brand_id=brand_a.id,
        message="E2E Drop Request",
        notes="Seeded ticket for admin publish E2E.",
        status="received",
    )
    drop_brief = Drop(
        id=_uuid(30),
        brand_id=brand_a.id,
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
        published_at=None,  # legacy-style unpublished stub / draft
    )
    drop_review = Drop(
        id=_uuid(31),
        brand_id=brand_a.id,
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
        published_at=now - timedelta(days=3),
    )
    drop_shipped = Drop(
        id=_uuid(32),
        brand_id=brand_b.id,
        title="Game Day Hoodies",
        description="Branded hoodies for collegiate game-day giveaways.",
        image="https://placehold.co/600x400/png",
        location="National",
        capacity_total=20,
        apply_open_at=now - timedelta(days=30),
        apply_close_at=now - timedelta(days=5),
        manual_reopen=False,
        # drop_active so the brand drop page shows linked-post insights
        # (awaiting_products hides that list until the drop is live).
        brand_tracker_stage=BrandTrackerStage.DROP_ACTIVE.value,
        total_product_units=400,
        campaign_hashtag="NorthwindGameDay",
        applicant_selection_finalized_at=now - timedelta(days=6),
        published_at=now - timedelta(days=30),
    )
    drop_finished = Drop(
        id=_uuid(33),
        brand_id=brand_b.id,
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
        published_at=now - timedelta(days=120),
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
        reach=4100,
        views=12400,
        saved=40,
        shares=12,
        total_interactions=90,
        ig_reels_avg_watch_time=1200,
        ig_reels_video_view_total_time=125000,
        reels_skip_rate=18,
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
        reach=900,
        views=2100,
        saved=7,
        shares=0,
        total_interactions=30,
        profile_visits=4,
        profile_activity=None,
        follows=2,
        metrics_updated_at=now,
    )
    post_unlinked = SocialPost(
        id=_uuid(52),
        org_id=org_active.id,
        platform=Platform.INSTAGRAM.value,
        external_id="ig_seed_feed_2",
        url="https://instagram.com/p/seed3",
        caption="Sunset row on the bay — thanks @acmecoffee",
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
        source=PostLinkSource.ORG_MANUAL.value,
        linked_at=now - timedelta(days=3),
    )
    link_feed = PostCampaignLink(
        id=_uuid(61),
        post_id=post_feed.id,
        application_id=app_accepted.id,
        source=PostLinkSource.ORG_MANUAL.value,
        linked_at=now - timedelta(days=2),
    )
    suggestion = PostCampaignSuggestion(
        id=_uuid(70),
        post_id=post_unlinked.id,
        application_id=app_accepted.id,
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
        "drop_requests": [request_e2e],
        "drops": [drop_brief, drop_review, drop_shipped, drop_finished],
        "drop_applications": [
            app_accepted,
            app_accepted_finished,
            app_applied,
            app_applied_review,
            app_denied,
            app_pending_org,
        ],
        "drop_application_shipments": [
            DropApplicationShipment(
                id=_uuid(46),
                application_id=app_accepted.id,
                tracking_number="1Z3V817W0392590700",
                carrier="ups",
            ),
            DropApplicationShipment(
                id=_uuid(47),
                application_id=app_accepted.id,
                tracking_number="876654644443",
                carrier="fedex",
            ),
        ],
        "social_posts": [post_reels, post_feed, post_unlinked],
        "post_campaign_links": [link, link_feed],
        "post_campaign_suggestions": [suggestion],
        "drop_tracker_events": [tracker_brief],
        "notify_me": [notify],
    }


async def _upsert_row(
    session: AsyncSession, model: type[Base], row_id: uuid.UUID
) -> tuple[Base, bool]:
    # no_autoflush: a previous new row may still be missing NOT NULL columns.
    with session.no_autoflush:
        row = await session.get(model, row_id)
    if row is not None:
        return row, False
    row = model(id=row_id)
    session.add(row)
    return row, True


async def upsert_staging_demo(session: AsyncSession, *, password: str) -> None:
    """Insert or update the fake Sample Org / Sample Brand demo. No deletes.

    A second run keeps the same primary keys and refreshes the apply window
    so Fall Cold Brew Launch stays open. ``password`` is the Sample Brand
    login secret supplied by the caller (never a committed default).
    """

    now = _now()
    org_user, _ = await _upsert_row(session, User, _SAMPLE_ORG_USER)
    club_user, _ = await _upsert_row(session, User, _SAMPLE_CLUB_USER)
    brand_user, _ = await _upsert_row(session, User, _SAMPLE_BRAND_USER)
    org_user.portal_role = PortalRole.ORG.value
    org_user.status = OrgUserStatus.ACTIVE.value
    org_user.edu_email = "sample-org@example.edu"
    org_user.email_verified_at = now
    org_user.instagram_username = "sampleorg"
    org_user.instagram_user_id = None
    org_user.instagram_access_token = None
    club_user.portal_role = PortalRole.ORG.value
    club_user.status = OrgUserStatus.ACTIVE.value
    club_user.edu_email = "sample-club@example.edu"
    club_user.email_verified_at = now
    club_user.instagram_username = "sampleclub"
    club_user.instagram_user_id = None
    club_user.instagram_access_token = None
    brand_user.portal_role = PortalRole.BRAND.value
    brand_user.status = OrgUserStatus.ACTIVE.value
    brand_user.password_hash = hash_password(password)
    brand_user.edu_email = None
    await session.flush()

    org, _ = await _upsert_row(session, Organization, _SAMPLE_ORG)
    club, _ = await _upsert_row(session, Organization, _SAMPLE_CLUB)
    org.user_id = org_user.id
    org.org_name = "Sample Org"
    org.university = "Sample University"
    org.follower_count = 1200
    org.member_count = 40
    org.category = OrgCategory.OTHER.value
    org.city = "Sample City"
    org.state = "CA"
    org.contact_name = "Sample Contact"
    org.delivery_address = "1 Sample Street, Sample City, CA 00000"
    org.shipping_line1 = "1 Sample Street"
    org.shipping_city = "Sample City"
    org.shipping_state = "CA"
    org.shipping_postal_code = "00000"
    org.approved_at = now
    org.claimed_instagram_username = "sampleorg"
    club.user_id = club_user.id
    club.org_name = "Sample Club"
    club.university = "Sample University"
    club.follower_count = 800
    club.member_count = 25
    club.category = OrgCategory.OTHER.value
    club.city = "Sample City"
    club.state = "CA"
    club.contact_name = "Sample Contact"
    club.approved_at = now
    club.claimed_instagram_username = "sampleclub"
    await session.flush()

    brand, _ = await _upsert_row(session, Brand, _SAMPLE_BRAND)
    brand.user_id = brand_user.id
    brand.brand_name = "Sample Brand"
    brand.company_email = "sample-brand@example.com"
    brand.instagram_handle = "samplebrand"
    brand.status = BrandStatus.APPROVED.value
    brand.approved_at = now
    await session.flush()

    drop, _ = await _upsert_row(session, Drop, _SAMPLE_DROP)
    drop.brand_id = brand.id
    drop.title = "Fall Cold Brew Launch"
    drop.description = (
        "Sample staging campaign. 200 cans of cold brew for campus events. "
        "Not a real brand and not a real drop."
    )
    drop.image = "https://placehold.co/600x400/png"
    drop.location = "Sample City"
    drop.capacity_total = 10
    drop.apply_open_at = now - timedelta(days=1)
    drop.apply_close_at = now + timedelta(days=30)
    drop.manual_reopen = False
    drop.brand_tracker_stage = BrandTrackerStage.AWAITING_PRODUCTS.value
    drop.total_product_units = 200
    drop.campaign_hashtag = "SampleFallBrew"
    drop.published_at = now - timedelta(days=1)
    drop.hidden_at = None
    await session.flush()

    app_org, org_created = await _upsert_row(session, DropApplication, _SAMPLE_APP_ORG)
    app_club, club_created = await _upsert_row(session, DropApplication, _SAMPLE_APP_CLUB)
    for application, created, owner in (
        (app_org, org_created, org),
        (app_club, club_created, club),
    ):
        application.drop_id = drop.id
        application.org_id = owner.id
        application.decision = ApplicationDecision.APPLIED.value
        application.pitch = "Sample application for the Fall Cold Brew Launch. Fake staging data."
        application.allocated_units = None
        application.decision_at = None
        if created:
            application.applied_at = now
    await session.flush()


async def _seed() -> None:
    mode = resolve_seed_mode(
        settings.DATABASE_URL,
        environment=settings.ENVIRONMENT,
        confirm=os.environ.get("STAGING_SEED_CONFIRM", ""),
        prod_hosts=prod_db_hosts_from_env(),
        frontend_url=settings.FRONTEND_URL,
    )

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        if mode == "staging":
            password = os.environ.get("STAGING_DEMO_PASSWORD", "").strip()
            if not password:
                print(
                    "refusing to seed: STAGING_DEMO_PASSWORD must be set for the staging demo.",
                    file=sys.stderr,
                )
                raise SystemExit(2)
            await upsert_staging_demo(session, password=password)
            await session.commit()
            print("staging demo seed complete (idempotent upsert)")
            print("brand login: sample-brand@example.com")
            print("orgs: Sample Org, Sample Club (no Instagram token; use admin View as)")
            await engine.dispose()
            return

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
