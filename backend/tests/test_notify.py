"""Tests for ``POST|DELETE /api/drops/{id}/notify`` (Stage 5A)."""

from __future__ import annotations

import uuid

from httpx import AsyncClient
from sqlalchemy import func, select

from app.models.notify_me import NotifyMe
from tests.conftest import (
    make_brand,
    make_drop,
    make_org,
    make_user,
    mint_access_token,
    persist,
)


async def _ctx(db_session):
    user = await persist(db_session, make_user())
    org = await make_org(db_session, user)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    return org, drop, headers


async def _notify_count(db_session, drop_id) -> int:
    return await db_session.scalar(
        select(func.count()).select_from(NotifyMe).where(NotifyMe.drop_id == drop_id)
    )


async def test_set_notify_creates_row(app_client: AsyncClient, db_session) -> None:
    _, drop, headers = await _ctx(db_session)
    resp = await app_client.post(
        f"/api/drops/{drop.id}/notify", headers=headers, json={"reminderMinutes": 15}
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["ok"] is True
    assert await _notify_count(db_session, drop.id) == 1


async def test_set_notify_upserts(app_client: AsyncClient, db_session) -> None:
    _, drop, headers = await _ctx(db_session)
    await app_client.post(
        f"/api/drops/{drop.id}/notify", headers=headers, json={"reminderMinutes": 15}
    )
    await app_client.post(
        f"/api/drops/{drop.id}/notify", headers=headers, json={"reminderMinutes": 60}
    )
    assert await _notify_count(db_session, drop.id) == 1
    row = await db_session.scalar(select(NotifyMe).where(NotifyMe.drop_id == drop.id))
    assert row.reminder_minutes == 60


async def test_delete_notify_idempotent(app_client: AsyncClient, db_session) -> None:
    _, drop, headers = await _ctx(db_session)
    await app_client.post(
        f"/api/drops/{drop.id}/notify", headers=headers, json={"reminderMinutes": 5}
    )
    r1 = await app_client.delete(f"/api/drops/{drop.id}/notify", headers=headers)
    assert r1.status_code == 200
    assert await _notify_count(db_session, drop.id) == 0
    # Deleting again is a no-op success.
    r2 = await app_client.delete(f"/api/drops/{drop.id}/notify", headers=headers)
    assert r2.status_code == 200


async def test_set_notify_invalid_minutes(app_client: AsyncClient, db_session) -> None:
    _, drop, headers = await _ctx(db_session)
    resp = await app_client.post(
        f"/api/drops/{drop.id}/notify", headers=headers, json={"reminderMinutes": 7}
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_set_notify_unknown_drop_404(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    await make_org(db_session, user)
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    resp = await app_client.post(
        f"/api/drops/{uuid.uuid4()}/notify", headers=headers, json={"reminderMinutes": 15}
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"
