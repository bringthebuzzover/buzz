"""Auth / onboarding orchestration (architecture.md §3.4).

Pure service functions — no FastAPI types — that the route layer calls. The
Instagram OAuth handshake terminates here at ``status = pending_org_profile``;
profile collection, email verification, and admin approval are Stage 7.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus, PortalRole
from app.models.user import User
from app.schemas.auth import UserResponse
from app.security import jwt
from app.security.session import bump_token_version
from app.security.token_crypto import encrypt_token
from app.services.instagram import ALLOWED_ACCOUNT_TYPES, InstagramClient
from app.services.instagram_token import clear_unusable_instagram_token


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
    # Match either Graph /me.id or the token-exchange user_id (deauthorize
    # sends the latter; they usually match but we store both).
    existing = await db.scalar(
        select(User).where(
            or_(
                User.instagram_user_id == profile.id,
                User.instagram_token_user_id == short.user_id,
                User.instagram_user_id == short.user_id,
                User.instagram_token_user_id == profile.id,
            )
        )
    )

    if existing is None:
        user = User(
            instagram_user_id=profile.id,
            instagram_token_user_id=short.user_id,
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
        existing.instagram_user_id = profile.id
        existing.instagram_token_user_id = short.user_id
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


async def revoke_instagram_authorization(db: AsyncSession, instagram_user_id: str) -> bool:
    """Handle a Meta deauthorize webhook: drop the token, kill live sessions.

    The user removed our app from their Instagram, so their stored token is
    dead. We null out the token fields and bump ``token_version`` (same trick
    logout / admin-deny use) to invalidate every outstanding refresh token.
    The user row is kept — deauthorize is not account deletion.

    Returns True when a matching user was revoked, False when the Meta
    ``user_id`` is unknown (callers must surface that distinctly — silent
    ``{ok:true}`` hid live tokens when Graph ``/me.id`` and exchange
    ``user_id`` diverged). Matches either ``instagram_user_id`` or
    ``instagram_token_user_id``.
    """

    user = await db.scalar(
        select(User).where(
            or_(
                User.instagram_user_id == instagram_user_id,
                User.instagram_token_user_id == instagram_user_id,
            )
        )
    )
    if user is None:
        return False
    clear_unusable_instagram_token(user)
    await db.flush()
    return True


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


async def issue_token_pair(db: AsyncSession, user: User) -> tuple[str, str]:
    """Bump ``token_version``, then mint ``(access_token, refresh_token)``.

    Every login and refresh rotation invalidates prior access + refresh tokens
    for this user (stolen cookies die on re-login / rotation).
    """

    bump_token_version(user)
    await db.flush()
    ver = user.token_version or 0
    access = jwt.create_access_token(user.id, user.portal_role, user.status, token_version=ver)
    refresh = jwt.create_refresh_token(user.id, token_version=ver)
    return access, refresh
