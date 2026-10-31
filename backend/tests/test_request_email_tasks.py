"""Request email tasks must run only after the production dependency commits."""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import db as db_dependency
from app.services.email_tasks import schedule_email


@pytest.mark.parametrize("failure", [None, "handler", "commit"])
async def test_request_email_follows_commit(monkeypatch, failure) -> None:
    events = []
    session = AsyncMock(spec=AsyncSession)

    async def commit():
        events.append("commit")
        if failure == "commit":
            raise RuntimeError("commit failed")

    session.commit.side_effect = commit

    @asynccontextmanager
    async def session_factory():
        yield session

    monkeypatch.setattr(db_dependency, "async_session_factory", session_factory)
    app = FastAPI()

    async def sender():
        events.append("email")
        return True

    @app.post("/send")
    async def route(tasks: BackgroundTasks, db: AsyncSession = Depends(db_dependency.get_db)):
        await schedule_email(tasks, sender)
        assert events == []
        if failure == "handler":
            raise HTTPException(status_code=400)
        return {"ok": True}

    async def observed_app(scope, receive, send):
        async def observed_send(message):
            if message["type"] == "http.response.body":
                events.append("response")
            await send(message)

        await app(scope, receive, observed_send)

    async with AsyncClient(
        transport=ASGITransport(app=observed_app, raise_app_exceptions=False),
        base_url="http://test",
    ) as client:
        response = await client.post("/send")

    if failure is None:
        assert response.status_code == 200
        assert events == ["commit", "response", "email"]
        session.rollback.assert_not_awaited()
    else:
        assert response.status_code == (400 if failure == "handler" else 500)
        assert "email" not in events
        session.rollback.assert_awaited_once()


async def test_direct_sender_keeps_delivery_result() -> None:
    sender = AsyncMock(return_value=False)
    assert await schedule_email(None, sender, "org1@example.edu", idempotency_key="test") is False
    sender.assert_awaited_once_with("org1@example.edu", idempotency_key="test")


@pytest.mark.parametrize("error", [None, RuntimeError("provider failed")])
async def test_failed_background_send_does_not_stop_remaining_emails(caplog, error) -> None:
    tasks = BackgroundTasks()
    failed = AsyncMock(return_value=False, side_effect=error)
    next_sender = AsyncMock(return_value=True)
    await schedule_email(tasks, failed)
    await schedule_email(tasks, next_sender)
    await tasks()
    next_sender.assert_awaited_once()
    assert "Background email delivery failed" in caplog.text
