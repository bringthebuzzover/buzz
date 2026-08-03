"""Password reset for brand and admin portals."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy import select

from app.config import settings
from app.models.enums import BrandStatus, OrgUserStatus, PortalRole
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.security import jwt
from app.security.password import hash_password
from app.services.password_reset import _hash_token
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


async def test_brand_forgot_unknown_email_same_shape(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/auth/brand/forgot-password",
        json={"email": "nobody@brand.test"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"] == {"ok": True}


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
    row.token_hash = _hash_token(raw)
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


async def test_brand_reset_expired_token(app_client: AsyncClient, db_session) -> None:
    _, user = await _active_brand(db_session, email="expired@brand.test")
    raw = "expired-token"
    db_session.add(
        PasswordResetToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=_hash_token(raw),
            email="expired@brand.test",
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
    )
    await db_session.flush()
    resp = await app_client.post(
        "/api/auth/brand/reset-password",
        json={"token": raw, "password": "new-password-9"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "PASSWORD_RESET_TOKEN_EXPIRED"


async def test_brand_reset_used_token(app_client: AsyncClient, db_session) -> None:
    _, user = await _active_brand(db_session, email="used@brand.test")
    raw = "used-token"
    db_session.add(
        PasswordResetToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=_hash_token(raw),
            email="used@brand.test",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            used_at=datetime.now(timezone.utc),
        )
    )
    await db_session.flush()
    resp = await app_client.post(
        "/api/auth/brand/reset-password",
        json={"token": raw, "password": "new-password-9"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "PASSWORD_RESET_TOKEN_USED"


async def test_post_reset_old_refresh_fails(app_client: AsyncClient, db_session) -> None:
    brand, user = await _active_brand(db_session, email="refresh@brand.test")
    refresh = jwt.create_refresh_token(user.id, token_version=0)
    raw = "bump-token"
    db_session.add(
        PasswordResetToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=_hash_token(raw),
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


async def test_admin_reset_happy_path(app_client: AsyncClient, db_session) -> None:
    user = await _active_admin(db_session)
    raw = "admin-reset-token"
    db_session.add(
        PasswordResetToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=_hash_token(raw),
            email=user.edu_email or "",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    )
    await db_session.flush()
    resp = await app_client.post(
        "/api/auth/admin/reset-password",
        json={"token": raw, "password": "admin-new-pass"},
    )
    assert resp.status_code == 200, resp.text
    login = await app_client.post(
        "/api/auth/admin/login",
        json={"email": user.edu_email, "password": "admin-new-pass"},
    )
    assert login.status_code == 200


async def test_admin_forgot_ok(app_client: AsyncClient, db_session) -> None:
    user = await _active_admin(db_session, email="forgot-admin@test.edu")
    resp = await app_client.post(
        "/api/auth/admin/forgot-password",
        json={"email": user.edu_email},
    )
    assert resp.status_code == 200
    assert resp.json()["data"] == {"ok": True}
    row = await db_session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
    )
    assert row is not None
