"""Contract test for the real ``get_db`` dependency's transaction boundary.

Every other test overrides ``get_db`` with a rolled-back session (see
``conftest.app_client``), which is great for isolation but means it can't catch a
regression in ``get_db`` itself — and exactly that slipped through once: services
use ``flush()`` and rely on ``get_db`` to ``commit()`` on a clean request, but
``get_db`` originally never committed, so every write was silently discarded.

These two tests drive the real ``get_db`` generator directly (no override) and
assert the commit/rollback boundary, writing to the same dev DB the suite uses
and cleaning up after themselves. They never need editing as features change.
"""

from __future__ import annotations

import uuid

import pytest

from app.deps.db import async_session_factory, engine, get_db
from app.models.enums import OrgUserStatus, PortalRole
from app.models.user import User


async def _reset_pool() -> None:
    """Rebind the module engine's pool to the current test's event loop.

    pytest-asyncio creates one loop per test; the module-level ``engine`` is
    created at import, so its pooled connections can belong to a prior loop
    ("attached to a different loop"). Disposing drops them; the next use
    reconnects on the active loop. (conftest avoids a session-scoped engine for
    the same reason.)
    """
    await engine.dispose()


def _row(uid: uuid.UUID) -> User:
    return User(
        id=uid,
        portal_role=PortalRole.ORG.value,
        status=OrgUserStatus.PENDING_ORG_PROFILE.value,
        instagram_user_id=f"commit-test-{uid}",
    )


async def test_get_db_commits_on_clean_exit() -> None:
    await _reset_pool()
    uid = uuid.uuid4()
    agen = get_db()
    session = await agen.__anext__()
    session.add(_row(uid))
    await session.flush()
    # Exhausting the generator runs the code after `yield` → commit.
    with pytest.raises(StopAsyncIteration):
        await agen.__anext__()

    try:
        async with async_session_factory() as verify:
            got = await verify.get(User, uid)
            assert got is not None, "flush()-only write must persist (get_db commits)"
    finally:
        async with async_session_factory() as cleanup:
            row = await cleanup.get(User, uid)
            if row is not None:
                await cleanup.delete(row)
                await cleanup.commit()


async def test_get_db_rolls_back_on_error() -> None:
    await _reset_pool()
    uid = uuid.uuid4()
    agen = get_db()
    session = await agen.__anext__()
    session.add(_row(uid))
    await session.flush()
    # Throwing into the generator simulates a handler raising → get_db rolls back.
    with pytest.raises(ValueError):
        await agen.athrow(ValueError("boom"))

    async with async_session_factory() as verify:
        assert await verify.get(User, uid) is None, "a raising request must not persist"
