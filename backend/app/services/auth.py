"""Auth / onboarding orchestration (architecture.md §3.4).

Pure service functions — no FastAPI types — that the route layer calls. The
Instagram OAuth handshake terminates here at ``status = pending_org_profile``;
profile collection, email verification, and admin approval are Stage 7.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus, PortalRole
from app.models.user import User
from app.schemas.auth import UserResponse
from app.security import jwt
from app.security.token_crypto import encrypt_token
from app.services.instagram import ALLOWED_ACCOUNT_TYPES, InstagramClient


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def handle_instagram_callback(
    db: AsyncSession,
    ig: InstagramClient,
    code: str,
) -> User:
    """Run the full OAuth handshake and upsert the org user (§3.4 Phase 1).

    Exchanges ``code`` → short-lived → long-lived token, verifies the account
    is Business/Creator, then persists the encrypted long-lived token. A new
    user is created ``org`` / ``pending_org_profile``; a returning user keeps
    their existing role + status (no downgrade of an active org).
    """

    short = await ig.exchange_code(code)
    long = await ig.exchange_for_long_lived(short.access_token)
    profile = await ig.fetch_profile(long.access_token)

    if profile.account_type.upper() not in ALLOWED_ACCOUNT_TYPES:
        raise BuzzAPIException(
            code=errors.INSTAGRAM_PERSONAL_ACCOUNT,
            message=(
                "Your Instagram account must be a Business or Creator account. "
                "Convert it in the Instagram app, then try again."
            ),
            status_code=400,
        )

    now = _now()
    expires_at = now + timedelta(seconds=long.expires_in)

    existing = await db.scalar(select(User).where(User.instagram_user_id == profile.id))

    if existing is None:
        user = User(
            instagram_user_id=profile.id,
            instagram_username=profile.username,
            instagram_access_token=encrypt_token(long.access_token),
            instagram_token_issued_at=now,
            instagram_token_expires_at=expires_at,
            instagram_token_refreshed_at=now,
            portal_role=PortalRole.ORG.value,
            status=OrgUserStatus.PENDING_ORG_PROFILE.value,
            last_login_at=now,
        )
        db.add(user)
    else:
        # Returning user: refresh the token + login stamp, preserve role/status.
        existing.instagram_username = profile.username
        existing.instagram_access_token = encrypt_token(long.access_token)
        existing.instagram_token_issued_at = now
        existing.instagram_token_expires_at = expires_at
        existing.instagram_token_refreshed_at = now
        existing.last_login_at = now
        user = existing

    # flush (not commit): the request-scoped get_db dependency commits on a
    # clean response and rolls back on error, so every service uses flush() for
    # one consistent transaction convention. refresh populates server defaults
    # (id/created_at) for the token + response.
    await db.flush()
    await db.refresh(user)
    return user


async def revoke_instagram_authorization(db: AsyncSession, instagram_user_id: str) -> None:
    """Handle a Meta deauthorize webhook: drop the token, kill live sessions.

    The user removed our app from their Instagram, so their stored token is
    dead. We null out the token fields and bump ``token_version`` (same trick
    logout / admin-deny use) to invalidate every outstanding refresh token.
    The user row is kept — deauthorize is not account deletion.

    Idempotent: unknown ``instagram_user_id`` is a silent no-op so Meta can
    retry safely.
    """

    user = await db.scalar(select(User).where(User.instagram_user_id == instagram_user_id))
    if user is None:
        return
    user.instagram_access_token = None
    user.instagram_token_issued_at = None
    user.instagram_token_expires_at = None
    user.instagram_token_refreshed_at = None
    user.token_version = (user.token_version or 0) + 1
    await db.flush()


def build_user_response(user: User) -> UserResponse:
    """Serialize a ``User`` into the API user payload."""

    # Imported lazily: app.deps.auth imports this module, so a module-level
    # import would be circular.
    from app.deps.auth import impersonated_by, impersonation_readonly

    admin_id = impersonated_by(user)
    return UserResponse(
        id=user.id,
        portal_role=user.portal_role,
        status=user.status,
        instagram_username=user.instagram_username,
        email=user.edu_email,
        impersonated_by=uuid.UUID(admin_id) if admin_id else None,
        impersonation_readonly=impersonation_readonly(user) if admin_id else None,
    )


def issue_token_pair(user: User) -> tuple[str, str]:
    """Mint ``(access_token, refresh_token)`` for an authenticated user."""

    access = jwt.create_access_token(user.id, user.portal_role, user.status)
    refresh = jwt.create_refresh_token(user.id, token_version=user.token_version or 0)
    return access, refresh
