"""Async SQLAlchemy engine, session factory, and FastAPI dependency.

The engine is created at import time so the lifespan handler in
`app.main` can dispose it cleanly on shutdown. `get_db()` yields an
`AsyncSession` for route handlers via FastAPI's `Depends()`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

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


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding a per-request `AsyncSession`."""

    async with async_session_factory() as session:
        yield session
