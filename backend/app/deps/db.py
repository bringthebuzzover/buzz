"""Async SQLAlchemy engine, session factory, and FastAPI dependency.

The engine is created at import time so the lifespan handler in
`app.main` can dispose it cleanly on shutdown. `get_db()` yields an
`AsyncSession` for route handlers via FastAPI's `Depends()`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import AsyncExitStack, asynccontextmanager
from dataclasses import dataclass

from fastapi import Request
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, future=True)

async_session_factory = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


@dataclass
class _CommitMark:
    done: bool = False


@asynccontextmanager
async def _commit_on_success(session: AsyncSession, mark: _CommitMark) -> AsyncIterator[None]:
    """Commit only when the function stack unwinds cleanly.

    FastAPI 0.121+ exits ``fastapi_function_astack`` *before* sending the
    body, and ``fastapi_inner_astack`` (request-scoped yield deps) *after*.
    Hooking commit here makes flush-only writes durable before the client
    can refetch. Errors skip the commit so ``get_db`` still rolls back.
    """

    try:
        yield
    except BaseException:
        raise
    else:
        await session.commit()
        mark.done = True


async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding a per-request `AsyncSession`.

    Commits on a clean request and rolls back if the handler raises. Services
    use ``flush()`` (not ``commit()``) so the whole request is one transaction;
    without this commit those flushed writes are discarded when the session
    closes. Tests override this dependency with their own rolled-back session.

    On a real FastAPI request the commit runs on the function stack (before
    the body is sent) so a client that immediately GETs the collection it
    just POSTed cannot race teardown. Generator-driven unit tests have no
    function stack; they still commit after ``yield``.
    """

    async with async_session_factory() as session:
        stack = request.scope.get("fastapi_function_astack")
        mark = _CommitMark()
        if isinstance(stack, AsyncExitStack):
            await stack.enter_async_context(_commit_on_success(session, mark))
        try:
            yield session
            if not mark.done:
                await session.commit()
        except Exception:
            await session.rollback()
            raise
