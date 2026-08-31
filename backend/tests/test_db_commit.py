"""Contract test for the real ``get_db`` dependency's transaction boundary.

Every other test overrides ``get_db`` with a rolled-back session (see
``conftest.app_client``), which is great for isolation but means it can't catch a
regression in ``get_db`` itself — and exactly that slipped through once: services
use ``flush()`` and rely on ``get_db`` to ``commit()`` on a clean request, but
``get_db`` originally never committed, so every write was silently discarded.

Generator tests drive ``get_db`` directly (no FastAPI function stack) and assert
the commit/rollback boundary. The ASGI tests use production ``get_db`` on a tiny
app and inspect visibility at ``http.response.start`` — httpx waiting for the
full ASGI call cannot reproduce the send-before-teardown race.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.types import Receive, Scope, Send

from app.deps.db import async_session_factory, engine, get_db
from app.exceptions import BuzzAPIException
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


def _bare_request() -> Request:
    """ASGI scope with no FastAPI function stack → after-yield commit fallback."""

    return Request(
        {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/",
            "raw_path": b"/",
            "query_string": b"",
            "headers": [],
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
        }
    )


async def _delete_user(uid: uuid.UUID) -> None:
    async with async_session_factory() as cleanup:
        row = await cleanup.get(User, uid)
        if row is not None:
            await cleanup.delete(row)
            await cleanup.commit()


async def test_get_db_commits_on_clean_exit() -> None:
    await _reset_pool()
    uid = uuid.uuid4()
    agen = get_db(_bare_request())
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
        await _delete_user(uid)


async def test_get_db_rolls_back_on_error() -> None:
    await _reset_pool()
    uid = uuid.uuid4()
    agen = get_db(_bare_request())
    session = await agen.__anext__()
    session.add(_row(uid))
    await session.flush()
    # Throwing into the generator simulates a handler raising → get_db rolls back.
    with pytest.raises(ValueError):
        await agen.athrow(ValueError("boom"))

    async with async_session_factory() as verify:
        assert await verify.get(User, uid) is None, "a raising request must not persist"


def _probe_app(uid: uuid.UUID, *, fail: str | None = None) -> FastAPI:
    probe = FastAPI()

    @probe.exception_handler(BuzzAPIException)
    async def _buzz(_request: Request, exc: BuzzAPIException) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @probe.post("/probe")
    async def probe_route(request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
        db.add(_row(uid))
        await db.flush()
        request.state.probe_uid = uid
        if fail == "http":
            raise HTTPException(status_code=400, detail="boom")
        if fail == "buzz":
            raise BuzzAPIException(code="TEST", message="boom", status_code=409)
        return {"id": str(uid)}

    return probe


def _wrap_visible_at_start(
    app: FastAPI, visible_at_start: list[bool]
) -> Callable[[Scope, Receive, Send], Awaitable[None]]:
    async def wrapping_app(scope: Scope, receive: Receive, send: Send) -> None:
        async def send_wrapper(message: dict[str, Any]) -> None:
            if message["type"] == "http.response.start":
                probe_uid = scope.get("state", {}).get("probe_uid")
                if probe_uid is not None:
                    async with async_session_factory() as verify:
                        visible_at_start.append(await verify.get(User, probe_uid) is not None)
            await send(message)

        await app(scope, receive, send_wrapper)

    return wrapping_app


async def test_get_db_commits_before_response_body() -> None:
    """Flush-only writes must be visible to another session at http.response.start.

    FastAPI sends the body before request-scoped yield-dep teardown. A client
    that refetches immediately (TanStack invalidateQueries) misses the row
    unless get_db commits on the function stack.
    """
    await _reset_pool()
    uid = uuid.uuid4()
    visible_at_start: list[bool] = []
    transport = ASGITransport(app=_wrap_visible_at_start(_probe_app(uid), visible_at_start))
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/probe")
        assert resp.status_code == 200
        assert visible_at_start == [True], "row must be committed before the response is sent"
    finally:
        await _delete_user(uid)


@pytest.mark.parametrize(
    ("fail", "status"),
    [("http", 400), ("buzz", 409)],
)
async def test_get_db_does_not_commit_before_error_response(fail: str, status: int) -> None:
    """A raising handler must roll back before the 4xx body is sent."""
    await _reset_pool()
    uid = uuid.uuid4()
    visible_at_start: list[bool] = []
    transport = ASGITransport(
        app=_wrap_visible_at_start(_probe_app(uid, fail=fail), visible_at_start)
    )
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/probe")
        assert resp.status_code == status
        assert visible_at_start == [
            False
        ], "a raising request must not persist before the error body is sent"
    finally:
        await _delete_user(uid)
