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
    PortalRole,
)
from app.models.organization import Organization
from app.security import jwt
from app.services.instagram import (
    InstagramProfile,
    LongLivedToken,
    ShortLivedToken,
    get_instagram_client,
)

_SCHEMA_READY = False


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
            username="testorg",
            account_type=self.account_type,
        )


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
        edu_email="org@test.edu",
        instagram_handle="testorg",
    )
    db.add(org)
    await db.flush()
    return org


async def make_brand(
    db: AsyncSession,
    *,
    brand_name: str = "Test Brand",
) -> Brand:
    """Persist a brand (and its owning brand user) for drops to reference."""

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
        company_email="brand@test.com",
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
) -> Drop:
    """Persist a ``drops`` row owned by ``brand`` (apply window open by default)."""

    now = datetime.now(timezone.utc)
    drop = Drop(
        id=uuid.uuid4(),
        brand_id=brand.id,
        brand_name=brand.brand_name,
        title=title,
        description="A test drop.",
        image="https://example.test/img.png",
        location="Test City",
        capacity_total=capacity_total,
        apply_open_at=apply_open_at or (now - timedelta(days=1)),
        apply_close_at=apply_close_at or (now + timedelta(days=7)),
        manual_reopen=False,
        brand_tracker_stage=BrandTrackerStage.AWAITING_BRIEF.value,
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
) -> DropApplication:
    """Persist a ``drop_applications`` row."""

    application = DropApplication(
        id=uuid.uuid4(),
        drop_id=drop.id,
        org_id=org.id,
        decision=decision.value,
    )
    db.add(application)
    await db.flush()
    return application


def mint_access_token(user: User) -> str:
    return jwt.create_access_token(user.id, user.portal_role, user.status)


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
    }
    return pyjwt.encode(claims, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
