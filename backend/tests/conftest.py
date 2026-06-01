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

from collections.abc import AsyncIterator

import pytest_asyncio
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import Session, SessionTransaction

from app.config import settings
from app.models import Base

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
