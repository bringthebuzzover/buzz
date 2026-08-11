"""Password reset for brand and admin accounts."""

from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException
from app.models.brand import Brand
from app.models.enums import OrgUserStatus, PortalRole
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.security.one_shot_tokens import hash_token
from app.security.password import hash_password
from app.security.session import bump_token_version
from app.services.email import send_password_reset_email

logger = logging.getLogger(__name__)

Portal = Literal["brand", "admin"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _find_user_for_reset(db: AsyncSession, portal: Portal, email: str) -> User | None:
    normalized = email.strip().lower()
    if portal == "brand":
        brand = await db.scalar(select(Brand).where(func.lower(Brand.company_email) == normalized))
        if brand is None:
            return None
        user = await db.get(User, brand.user_id)
        if (
            user is None
            or user.portal_role != PortalRole.BRAND.value
            or user.status != OrgUserStatus.ACTIVE.value
            or not user.password_hash
        ):
            return None
        return user

    user = await db.scalar(
        select(User).where(
            func.lower(User.edu_email) == normalized,
            User.portal_role == PortalRole.ADMIN.value,
        )
    )
    if (
        not isinstance(user, User)
        or user.status != OrgUserStatus.ACTIVE.value
        or not user.password_hash
    ):
        return None
    return user


async def request_password_reset(
    db: AsyncSession,
    *,
    portal: Portal,
    email: str,
) -> dict[str, Any]:
    """Enumerate-safe forgot-password: always returns the same success shape."""
    normalized = email.strip().lower()
    user = await _find_user_for_reset(db, portal, normalized)
    if user is None:
        return {"ok": True}

    now = _now()
    await db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now)
    )

    raw = secrets.token_urlsafe(48)
    row = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hash_token(raw),
        email=normalized,
        expires_at=now + timedelta(hours=settings.PASSWORD_RESET_TOKEN_TTL_HOURS),
    )
    db.add(row)
    await db.flush()

    ok = await send_password_reset_email(normalized, raw, portal=portal)
    if not ok:
        # Keep the forgot-password response opaque; burn the unused token so a
        # failed send cannot leave a live link that never reached the user.
        row.used_at = now
        await db.flush()
        logger.warning(
            "Password reset email failed; token invalidated: portal=%s to=%s",
            portal,
            normalized,
        )
    return {"ok": True}


async def reset_password(
    db: AsyncSession,
    *,
    portal: Portal,
    token: str,
    password: str,
) -> dict[str, Any]:
    """Consume a reset token, set the new password, and bump token_version."""
    now = _now()
    token_hash = hash_token(token)
    row = await db.scalar(
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == token_hash)
        .with_for_update()
    )
    if row is None:
        raise BuzzAPIException(
            errors.PASSWORD_RESET_TOKEN_INVALID,
            "Invalid or expired reset link.",
            status_code=400,
        )
    if row.used_at is not None:
        raise BuzzAPIException(
            errors.PASSWORD_RESET_TOKEN_USED,
            "This reset link has already been used.",
            status_code=400,
        )
    if row.expires_at < now:
        raise BuzzAPIException(
            errors.PASSWORD_RESET_TOKEN_EXPIRED,
            "This reset link has expired. Request a new one.",
            status_code=400,
        )

    user = await db.get(User, row.user_id)
    expected_role = PortalRole.BRAND.value if portal == "brand" else PortalRole.ADMIN.value
    if user is None or user.portal_role != expected_role:
        raise BuzzAPIException(
            errors.PASSWORD_RESET_TOKEN_INVALID,
            "Invalid or expired reset link.",
            status_code=400,
        )

    row.used_at = now
    user.password_hash = hash_password(password)
    bump_token_version(user)
    await db.flush()
    return {"ok": True}
