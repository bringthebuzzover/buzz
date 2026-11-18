"""Password reset for brand portal."""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import db as db_dependency
from app.main import app
from app.models.enums import BrandStatus, OrgUserStatus, PortalRole
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.security import jwt
from app.security.one_shot_tokens import hash_token
from app.security.password import hash_password
from tests.conftest import make_brand, make_user, persist

REFRESH = settings.REFRESH_COOKIE_NAME


async def _active_brand(db_session, *, email: str = "reset@brand.test"):
    brand = await make_brand(db_session, brand_name="Reset Brand", company_email=email)
    brand.status = BrandStatus.APPROVED.value
    user = await db_session.get(User, brand.user_id)
    assert user is not None
    user.status = OrgUserStatus.ACTIVE.value
    user.password_hash = hash_password("old-password-1")
    user.token_version = 0
    await db_session.flush()
    return brand, user


async def _active_admin(db_session, *, email: str = "admin-reset@test.edu"):
    user = await persist(db_session, make_user(role=PortalRole.ADMIN))
    user.edu_email = email
    user.password_hash = hash_password("old-password-1")
    user.token_version = 0
    await db_session.flush()
    return user


@pytest.mark.parametrize("commit_fails", [False, True])
async def test_forgot_password_sends_only_after_commit(db_session, monkeypatch, commit_fails):
    email = "reset@example.test"
    _, user = await _active_brand(db_session, email=email)
    user_id = user.id
    events = []
    session = AsyncSession(
        bind=await db_session.connection(), join_transaction_mode="create_savepoint"
    )
    original_commit = session.commit

    async def commit():
        if commit_fails:
            raise RuntimeError("commit failed")
        await original_commit()
        events.append("commit")

    async def send(*args, **kwargs):
        assert events == ["commit"]
        events.append("email")
        return True

    @asynccontextmanager
    async def session_factory():
        async with session:
            yield session

    sender = AsyncMock(side_effect=send)
    rollback = AsyncMock(wraps=session.rollback)
    monkeypatch.setattr(db_dependency, "async_session_factory", session_factory)
    monkeypatch.setattr(session, "commit", commit)
    monkeypatch.setattr(session, "rollback", rollback)
    monkeypatch.setattr("app.services.password_reset.send_password_reset_email", sender)
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="https://test"
    ) as client:
        response = await client.post("/api/auth/brand/forgot-password", json={"email": email})

    token = await db_session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.user_id == user_id)
    )
    if commit_fails:
        assert response.status_code == 500
        rollback.assert_awaited_once()
        sender.assert_not_awaited()
        assert token is None
    else:
        assert response.status_code == 200
        assert events == ["commit", "email"]
        sender.assert_awaited_once()
        assert token is not None


async def test_brand_forgot_unknown_email_same_shape(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/auth/brand/forgot-password",
        json={"email": "nobody@brand.test"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"] == {"ok": True}


async def test_brand_forgot_send_failed_invalidates_token(
    app_client: AsyncClient, db_session, monkeypatch, email_cleanup_session
) -> None:
    brand, user = await _active_brand(db_session, email="send-fail@brand.test")

    async def _fail(*_a, **_k):
        return False

    monkeypatch.setattr("app.services.password_reset.send_password_reset_email", _fail)
    resp = await app_client.post(
        "/api/auth/brand/forgot-password",
        json={"email": brand.company_email},
    )
    assert resp.status_code == 200
    assert resp.json()["data"] == {"ok": True}
    row = await db_session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
    )
    assert row is not None
    assert row.used_at is not None


async def test_brand_reset_happy_path(app_client: AsyncClient, db_session) -> None:
    brand, user = await _active_brand(db_session)
    forgot = await app_client.post(
        "/api/auth/brand/forgot-password",
        json={"email": brand.company_email},
    )
    assert forgot.status_code == 200
    row = await db_session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
    )
    assert row is not None
    # Recover raw token by checking against a freshly minted one is hard; mint
    # a known token for the reset step instead.
    raw = "brand-reset-token-raw-value"
    row.token_hash = hash_token(raw)
    row.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    row.used_at = None
    await db_session.flush()

    reset = await app_client.post(
        "/api/auth/brand/reset-password",
        json={"token": raw, "password": "new-password-9"},
    )
    assert reset.status_code == 200, reset.text
    await db_session.refresh(user)
    assert user.token_version == 1

    login = await app_client.post(
        "/api/auth/brand/login",
        json={"email": brand.company_email, "password": "new-password-9"},
    )
    assert login.status_code == 200


@pytest.mark.parametrize(
    ("expires_in", "used", "code"),
    [
        (timedelta(minutes=-1), False, "PASSWORD_RESET_TOKEN_EXPIRED"),
        (timedelta(hours=1), True, "PASSWORD_RESET_TOKEN_USED"),
    ],
)
async def test_brand_reset_dead_token(
    app_client: AsyncClient, db_session, expires_in: timedelta, used: bool, code: str
) -> None:
    _, user = await _active_brand(db_session, email="dead@brand.test")
    raw = "dead-token"
    now = datetime.now(timezone.utc)
    db_session.add(
        PasswordResetToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=hash_token(raw),
            email="dead@brand.test",
            expires_at=now + expires_in,
            used_at=now if used else None,
        )
    )
    await db_session.flush()
    resp = await app_client.post(
        "/api/auth/brand/reset-password",
        json={"token": raw, "password": "new-password-9"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == code


async def test_post_reset_old_refresh_fails(app_client: AsyncClient, db_session) -> None:
    brand, user = await _active_brand(db_session, email="refresh@brand.test")
    refresh = jwt.create_refresh_token(user.id, token_version=0)
    raw = "bump-token"
    db_session.add(
        PasswordResetToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=hash_token(raw),
            email=brand.company_email,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    )
    await db_session.flush()

    await app_client.post(
        "/api/auth/brand/reset-password",
        json={"token": raw, "password": "newer-password-1"},
    )
    app_client.cookies.set(REFRESH, refresh)
    resp = await app_client.post("/api/auth/refresh")
    assert resp.status_code == 401


@pytest.mark.parametrize("has_brand", [False, True])
async def test_brand_forgot_refuses_admin(
    app_client: AsyncClient, db_session, monkeypatch, has_brand: bool
) -> None:
    email = "admin-reset@example.edu"
    if has_brand:
        _, user = await _active_brand(db_session, email=email)
        user.portal_role = PortalRole.ADMIN.value
        await db_session.flush()
    else:
        user = await _active_admin(db_session, email=email)
    sender = AsyncMock()
    monkeypatch.setattr("app.services.password_reset.send_password_reset_email", sender)

    responses = [
        await app_client.post("/api/auth/brand/forgot-password", json={"email": address})
        for address in (email, "unknown@example.edu")
    ]
    assert [response.status_code for response in responses] == [200, 200]
    assert [response.json()["data"] for response in responses] == [{"ok": True}] * 2
    assert (
        await db_session.scalar(
            select(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
        )
        is None
    )
    sender.assert_not_awaited()


async def test_brand_reset_refuses_existing_admin_token(
    app_client: AsyncClient, db_session
) -> None:
    user = await _active_admin(db_session)
    old_hash = user.password_hash
    raw = "old-admin-token"
    row = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hash_token(raw),
        email=user.edu_email or "",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db_session.add(row)
    await db_session.flush()

    response = await app_client.post(
        "/api/auth/brand/reset-password", json={"token": raw, "password": "new-password-9"}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "PASSWORD_RESET_TOKEN_INVALID"
    await db_session.refresh(user)
    await db_session.refresh(row)
    assert user.password_hash == old_hash
    assert user.token_version == 0
    assert row.used_at is None
