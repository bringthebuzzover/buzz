"""Org Connect Instagram one-shot tokens (LAUNCH.md Phase A).

Mirrors brand invite mint/redeem: invalidate prior unused tokens, hash at rest,
TTL from ``ORG_CONNECT_TOKEN_TTL_DAYS``.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus, PortalRole
from app.models.org_connect_token import OrgConnectToken
from app.models.organization import Organization
from app.models.user import User
from app.security.one_shot_tokens import hash_token


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def create_org_connect_token(db: AsyncSession, org: Organization, user: User) -> str:
    """Invalidate prior unused connect tokens and mint a new raw token."""
    now = _now()
    await db.execute(
        sa_update(OrgConnectToken)
        .where(
            OrgConnectToken.org_id == org.id,
            OrgConnectToken.used_at.is_(None),
        )
        .values(used_at=now)
    )

    raw = secrets.token_urlsafe(48)
    row = OrgConnectToken(
        id=uuid.uuid4(),
        user_id=user.id,
        org_id=org.id,
        token_hash=hash_token(raw),
        email=user.edu_email or "",
        expires_at=now + timedelta(days=settings.ORG_CONNECT_TOKEN_TTL_DAYS),
    )
    db.add(row)
    await db.flush()
    return raw


async def redeem_org_connect_token(db: AsyncSession, token: str) -> User:
    """Consume a connect token; return the org user (must be pending_instagram)."""
    now = _now()
    row = await db.scalar(
        select(OrgConnectToken)
        .where(OrgConnectToken.token_hash == hash_token(token))
        .with_for_update()
    )
    if row is None:
        raise BuzzAPIException(
            errors.VERIFICATION_TOKEN_INVALID,
            "Invalid connect link.",
            status_code=400,
        )
    if row.used_at is not None:
        raise BuzzAPIException(
            errors.VERIFICATION_TOKEN_USED,
            "This connect link has already been used.",
            status_code=400,
        )
    if row.expires_at < now:
        raise BuzzAPIException(
            errors.VERIFICATION_TOKEN_EXPIRED,
            "Connect link has expired. Ask Buzz to resend it.",
            status_code=400,
        )

    user = await db.get(User, row.user_id)
    if user is None or user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(errors.NOT_FOUND, "User not found.", status_code=404)
    if user.status != OrgUserStatus.PENDING_INSTAGRAM.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "This account is not waiting to connect Instagram.",
            status_code=400,
        )

    row.used_at = now
    await db.flush()
    return user
