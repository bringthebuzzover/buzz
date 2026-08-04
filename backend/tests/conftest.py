"""Shared pytest fixtures for the backend test suite.

DB-touching tests run against the same ``buzz`` database as local dev so we
don't need a separate ``buzz_test`` database (per the Stage 2 plan).
Isolation comes from wrapping every test in a transaction that is rolled
back on teardown — see ``db_session`` below.

The constraint tests in ``test_constraints.py`` need to flush/commit and
then catch ``IntegrityError`` from a second statement. We use SQLAlchemy's
standard "join an external transaction" recipe so the session runs inside
a SAVEPOINT that is automatically restarted after each commit; that way a
failing commit only burns the savepoint, never the outer transaction.

We deliberately do NOT use a session-scoped async engine. pytest-asyncio
1.x creates one event loop per test, so a session-scoped async fixture
ends up with database connections attached to a stale loop. Re-creating
the engine per test costs ~1ms — cheaper than fighting the loop scope.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import Session, SessionTransaction

from app.config import settings
from app.deps.db import get_db
from app.main import app
from app.models import Base, User
from app.models.application import DropApplication
from app.models.brand import Brand
from app.models.drop import Drop
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
from app.models.notify_me import NotifyMe
from app.models.organization import Organization
from app.models.post_link import PostCampaignLink
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.social_post import SocialPost
from app.models.tracker_event import DropTrackerEvent
from app.security import jwt, rate_limit
from app.services.instagram import (
    InstagramProfile,
    LongLivedToken,
    MediaFields,
    MediaRef,
    ShortLivedToken,
    get_instagram_client,
)

_SCHEMA_READY = False


@pytest.fixture(autouse=True)
def _disable_rate_limiting():
    """Rate limiting off for the suite (in-memory counters would leak across the
    many auth-endpoint hits in one process). The dedicated rate-limit test
    re-enables it and resets the store itself."""
    prev = settings.RATE_LIMIT_ENABLED
    settings.RATE_LIMIT_ENABLED = False
    rate_limit.reset()
    yield
    settings.RATE_LIMIT_ENABLED = prev
    rate_limit.reset()


@pytest_asyncio.fixture
async def engine() -> AsyncIterator[AsyncEngine]:
    """Per-test async engine bound to ``settings.DATABASE_URL``.

    On first use the full schema is created (``Base.metadata.create_all``
    after a defensive ``drop_all``) so tests are robust to a leftover dev
    schema. Subsequent tests reuse the existing tables since DDL is global
    to the database, not per-connection.
    """

    global _SCHEMA_READY
    eng = create_async_engine(settings.DATABASE_URL, future=True)
    if not _SCHEMA_READY:
        async with eng.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        _SCHEMA_READY = True
    try:
        yield eng
    finally:
        await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """Per-test ``AsyncSession`` rolled back at teardown.

    Implements the standard "join an external transaction" pattern so
    tests can ``commit()`` mid-body (the constraint tests do this) without
    leaking state to neighbouring tests.
    """

    connection = await engine.connect()
    outer_txn = await connection.begin()

    session_factory = async_sessionmaker(bind=connection, expire_on_commit=False)
    session = session_factory()
    await session.begin_nested()

    @event.listens_for(session.sync_session, "after_transaction_end")
    def _restart_savepoint(sync_session: Session, transaction: SessionTransaction) -> None:
        # When the SAVEPOINT used by the session ends (either normal commit
        # or rollback after IntegrityError), open a fresh one so subsequent
        # session operations stay isolated from the outer transaction.
        if transaction.nested and transaction.parent is not None and not transaction.parent.nested:
            sync_session.begin_nested()

    try:
        yield session
    finally:
        await session.close()
        await outer_txn.rollback()
        await connection.close()


# --- Auth test helpers -------------------------------------------------------


class FakeInstagramClient:
    """In-memory ``InstagramClient`` for tests — no network.

    ``account_type`` is configurable so a single fixture can drive the
    Business/Creator success path and the Personal-account rejection. The
    last ``code``/``state`` seen are captured for assertions.
    """

    def __init__(self, *, account_type: str = "BUSINESS", user_id: str = "ig_test_1") -> None:
        self.account_type = account_type
        self.user_id = user_id
        self.username = "testorg"
        self.long_lived_token = "fake-long-lived-token"
        self.seen_code: str | None = None

    def build_authorize_url(self, state: str) -> str:
        return (
            "https://www.instagram.com/oauth/authorize"
            f"?client_id=test&scope=instagram_business_basic&response_type=code&state={state}"
        )

    async def exchange_code(self, code: str) -> ShortLivedToken:
        self.seen_code = code
        return ShortLivedToken(access_token="fake-short-lived", user_id=self.user_id)

    async def exchange_for_long_lived(self, short_token: str) -> LongLivedToken:
        return LongLivedToken(access_token=self.long_lived_token, expires_in=5183944)

    async def fetch_profile(self, long_token: str) -> InstagramProfile:
        return InstagramProfile(
            id=self.user_id,
            username=self.username,
            account_type=self.account_type,
        )

    # --- Stage 8 surface (configurable per test; sensible defaults) ---

    async def refresh_long_lived(self, long_token: str) -> LongLivedToken:
        self.refreshed_with = long_token
        return LongLivedToken(access_token="fake-refreshed-token", expires_in=5183944)

    async def fetch_user_media(
        self, long_token: str, *, limit: int = 50, max_pages: int = 10
    ) -> list["MediaRef"]:
        return list(getattr(self, "media", []))

    async def fetch_media(self, long_token: str, media_id: str) -> "MediaFields":
        fields = getattr(self, "media_fields", {})
        if media_id in fields:
            return fields[media_id]
        return MediaFields(
            id=media_id,
            caption="default caption",
            media_type="IMAGE",
            media_product_type="FEED",
            permalink=f"https://instagram.com/p/{media_id}",
            thumbnail_url=None,
            media_url=None,
            timestamp="2030-01-01T00:00:00+0000",
            like_count=10,
            comments_count=2,
        )

    async def fetch_media_insights(
        self, long_token: str, media_id: str, *, is_reel: bool = False
    ) -> dict[str, int | float]:
        return dict(getattr(self, "insights", {"reach": 100, "saved": 5}))


@pytest_asyncio.fixture
async def app_client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    """HTTP client bound to the ASGI app, sharing the rolled-back ``db_session``.

    The ``get_db`` override yields the *already open* per-test session (no
    ``async with``/``close()`` — teardown belongs to ``db_session``) so route
    handlers commit into the same transaction the fixture rolls back.
    """

    async def _override_get_db() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    # https base URL so the cookie jar forwards Secure cookies (the refresh +
    # OAuth-state cookies are Secure by default) across requests.
    try:
        async with AsyncClient(transport=transport, base_url="https://test") as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
def fake_instagram() -> AsyncIterator[FakeInstagramClient]:
    """Install a ``FakeInstagramClient`` via dependency override."""

    fake = FakeInstagramClient()
    app.dependency_overrides[get_instagram_client] = lambda: fake
    try:
        yield fake
    finally:
        app.dependency_overrides.pop(get_instagram_client, None)


def make_user(
    *,
    role: PortalRole = PortalRole.ORG,
    status: OrgUserStatus = OrgUserStatus.ACTIVE,
    instagram_user_id: str | None = None,
) -> User:
    """Build (not persist) a ``User`` with sensible auth-test defaults."""

    return User(
        id=uuid.uuid4(),
        portal_role=role.value,
        status=status.value,
        instagram_user_id=instagram_user_id,
        instagram_username="testorg" if role is PortalRole.ORG else None,
    )


async def persist(db: AsyncSession, user: User) -> User:
    db.add(user)
    await db.flush()
    return user


# --- Drops-feed test helpers (Stage 4) ---------------------------------------


async def make_org(
    db: AsyncSession,
    user: User,
    *,
    org_name: str = "Test Org",
) -> Organization:
    """Persist an ``organizations`` row for an org ``user``."""

    org = Organization(
        id=uuid.uuid4(),
        user_id=user.id,
        org_name=org_name,
        university="Test University",
    )
    db.add(org)
    await db.flush()
    return org


async def make_brand(
    db: AsyncSession,
    *,
    brand_name: str = "Test Brand",
    company_email: str | None = None,
) -> Brand:
    """Persist a brand (and its owning brand user) for drops to reference.

    ``company_email`` defaults to a unique value per call so multiple brands in
    one test don't collide on the ``lower(company_email)`` unique index; pass an
    explicit value when a test asserts a specific email.
    """

    brand_user = User(
        id=uuid.uuid4(),
        portal_role=PortalRole.BRAND.value,
        status=OrgUserStatus.ACTIVE.value,
    )
    db.add(brand_user)
    await db.flush()
    brand = Brand(
        id=uuid.uuid4(),
        user_id=brand_user.id,
        brand_name=brand_name,
        company_email=company_email or f"brand-{uuid.uuid4().hex[:12]}@test.com",
        status=BrandStatus.APPROVED.value,
    )
    db.add(brand)
    await db.flush()
    return brand


async def make_drop(
    db: AsyncSession,
    brand: Brand,
    *,
    title: str = "Test Drop",
    capacity_total: int = 5,
    apply_open_at: datetime | None = None,
    apply_close_at: datetime | None = None,
    manual_reopen: bool = False,
    stage: BrandTrackerStage = BrandTrackerStage.REQUEST_RECEIVED,
    total_product_units: int | None = None,
) -> Drop:
    """Persist a ``drops`` row owned by ``brand`` (apply window open by default)."""

    now = datetime.now(timezone.utc)
    drop = Drop(
        id=uuid.uuid4(),
        brand_id=brand.id,
        title=title,
        description="A test drop.",
        image="https://example.test/img.png",
        location="Test City",
        capacity_total=capacity_total,
        apply_open_at=apply_open_at or (now - timedelta(days=1)),
        apply_close_at=apply_close_at or (now + timedelta(days=7)),
        manual_reopen=manual_reopen,
        brand_tracker_stage=stage.value,
        total_product_units=total_product_units,
    )
    db.add(drop)
    await db.flush()
    return drop


async def make_application(
    db: AsyncSession,
    drop: Drop,
    org: Organization,
    *,
    decision: ApplicationDecision = ApplicationDecision.APPLIED,
    pitch: str | None = None,
    applied_at: datetime | None = None,
) -> DropApplication:
    """Persist a ``drop_applications`` row."""

    application = DropApplication(
        id=uuid.uuid4(),
        drop_id=drop.id,
        org_id=org.id,
        decision=decision.value,
        pitch=pitch,
    )
    if applied_at is not None:
        application.applied_at = applied_at
    db.add(application)
    await db.flush()
    return application


async def make_notify(
    db: AsyncSession,
    org: Organization,
    drop: Drop,
    *,
    reminder_minutes: int = 15,
) -> NotifyMe:
    """Persist a ``notify_me`` row for an org+drop."""

    notify = NotifyMe(
        id=uuid.uuid4(),
        org_id=org.id,
        drop_id=drop.id,
        reminder_minutes=reminder_minutes,
        enabled=True,
    )
    db.add(notify)
    await db.flush()
    return notify


# --- Posts / links / suggestions test helpers (Stage 5B) ---------------------


async def make_social_post(
    db: AsyncSession,
    org: Organization,
    *,
    external_id: str | None = None,
    caption: str = "loved the drop",
    likes: int = 10,
    comments: int = 2,
    media_product_type: SocialMediaProductType = SocialMediaProductType.FEED,
) -> SocialPost:
    """Persist a ``social_posts`` row owned by ``org``."""

    ext = external_id or f"ext_{uuid.uuid4().hex[:12]}"
    post = SocialPost(
        id=uuid.uuid4(),
        org_id=org.id,
        platform=Platform.INSTAGRAM.value,
        external_id=ext,
        url=f"https://instagram.test/p/{ext}",
        thumbnail_url="https://instagram.test/thumb.jpg",
        caption=caption,
        media_type=SocialMediaType.IMAGE.value,
        media_product_type=media_product_type.value,
        posted_at=datetime.now(timezone.utc) - timedelta(days=1),
        likes=likes,
        comments=comments,
        metrics_updated_at=datetime.now(timezone.utc),
    )
    db.add(post)
    await db.flush()
    return post


async def make_post_link(
    db: AsyncSession,
    post: SocialPost,
    application: DropApplication,
    *,
    source: PostLinkSource = PostLinkSource.ORG_MANUAL,
) -> PostCampaignLink:
    """Persist a ``post_campaign_links`` row (drop_id from the application)."""

    link = PostCampaignLink(
        id=uuid.uuid4(),
        post_id=post.id,
        application_id=application.id,
        source=source.value,
    )
    db.add(link)
    await db.flush()
    return link


async def make_suggestion(
    db: AsyncSession,
    post: SocialPost,
    application: DropApplication,
    *,
    match_reason: SuggestionMatchReason = SuggestionMatchReason.BRAND_HANDLE_CAPTION,
    match_evidence: str = "...loved the @brand drop...",
) -> PostCampaignSuggestion:
    """Persist a pending ``post_campaign_suggestions`` row."""

    suggestion = PostCampaignSuggestion(
        id=uuid.uuid4(),
        post_id=post.id,
        application_id=application.id,
        match_reason=match_reason.value,
        match_evidence=match_evidence,
    )
    db.add(suggestion)
    await db.flush()
    return suggestion


async def make_tracker_event(
    db: AsyncSession,
    drop: Drop,
    *,
    stage: BrandTrackerStage = BrandTrackerStage.REQUEST_RECEIVED,
    note: str | None = None,
) -> DropTrackerEvent:
    """Persist a ``drop_tracker_events`` row."""
    event = DropTrackerEvent(
        id=uuid.uuid4(),
        drop_id=drop.id,
        stage=stage.value,
        note=note,
    )
    db.add(event)
    await db.flush()
    return event


def mint_access_token(user: User) -> str:
    return jwt.create_access_token(
        user.id,
        user.portal_role,
        user.status,
        token_version=user.token_version or 0,
    )


def mint_expired_access_token(user: User) -> str:
    """An access token whose ``exp`` is already in the past."""

    import jwt as pyjwt

    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(user.id),
        "type": jwt.ACCESS_TOKEN_TYPE,
        "role": user.portal_role,
        "status": user.status,
        "iat": now - timedelta(hours=2),
        "exp": now - timedelta(hours=1),
        "jti": uuid.uuid4().hex,
        "ver": user.token_version or 0,
    }
    return pyjwt.encode(claims, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
