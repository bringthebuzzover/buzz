"""Auth / onboarding orchestration (architecture.md §3.4).

Pure service functions — no FastAPI types — that the route layer calls.
Instagram OAuth: returning users refresh tokens; Connect binds an existing
apply-first user; unknown Graph ids without bind context do **not** insert
(``ORG_APPLY_REQUIRED`` — LAUNCH.md Phase A).
"""

from __future__ import annotations

import logging
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
from app.services.instagram import (
    ALLOWED_ACCOUNT_TYPES,
    InstagramClient,
    canonical_instagram_handle,
)
from app.services.instagram_token import clear_unusable_instagram_token

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def handle_instagram_callback(
    db: AsyncSession,
    ig: InstagramClient,
    code: str,
    *,
    bind_user_id: uuid.UUID | None = None,
) -> User:
    """OAuth handshake: bind existing user, refresh returning user, or reject insert.

    * ``bind_user_id`` set (Connect flow) → update that pending_instagram user.
    * Graph id already on a user → refresh tokens (returning login).
    * Unknown Graph id, no bind → ``ORG_APPLY_REQUIRED`` (no INSERT).
    """

    short = await ig.exchange_code(code)
    long = await ig.exchange_for_long_lived(short.access_token)
    profile = await ig.fetch_profile(long.access_token)

    account_type = profile.account_type.upper()
    if account_type not in ALLOWED_ACCOUNT_TYPES:
        logger.warning(
            "instagram callback rejected account_type=%s ig_user_id=%s",
            account_type,
            profile.id,
        )
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

    if bind_user_id is not None:
        target = await db.get(User, bind_user_id)
        if target is None or target.portal_role != PortalRole.ORG.value:
            raise BuzzAPIException(
                errors.NOT_FOUND,
                "Organization account not found.",
                status_code=404,
            )
        if target.status != OrgUserStatus.PENDING_INSTAGRAM.value:
            raise BuzzAPIException(
                errors.INVALID_ONBOARDING_STATE,
                "This account is not waiting to connect Instagram.",
                status_code=400,
            )
        if existing is not None and existing.id != target.id:
            raise BuzzAPIException(
                errors.INSTAGRAM_HANDLE_TAKEN,
                "This Instagram account is already linked to another Buzz user.",
                status_code=409,
            )
        claimed = canonical_instagram_handle(target.instagram_username)
        graph_handle = canonical_instagram_handle(profile.username)
        if claimed and graph_handle and claimed.lower() != graph_handle.lower():
            logger.info(
                "instagram bind handle overwrite user_id=%s claimed=%s graph=%s",
                target.id,
                claimed,
                graph_handle,
            )
        _apply_ig_credentials(target, profile, short.user_id, long.access_token, now, expires_at)
        target.status = OrgUserStatus.ACTIVE.value
        target.last_login_at = now
        user = target
    elif existing is None:
        raise BuzzAPIException(
            code=errors.ORG_APPLY_REQUIRED,
            message=(
                "No Buzz organization is linked to this Instagram account. "
                "Apply first at /org/apply, then connect Instagram after approval."
            ),
            status_code=400,
        )
    else:
        _apply_ig_credentials(existing, profile, short.user_id, long.access_token, now, expires_at)
        existing.last_login_at = now
        if existing.status == OrgUserStatus.PENDING_INSTAGRAM.value:
            existing.status = OrgUserStatus.ACTIVE.value
        user = existing

    await db.flush()
    await db.refresh(user)
    return user


def _apply_ig_credentials(
    user: User,
    profile: object,
    token_user_id: str,
    long_token: str,
    now: datetime,
    expires_at: datetime,
) -> None:
    user.instagram_user_id = profile.id  # type: ignore[attr-defined]
    user.instagram_token_user_id = token_user_id
    user.instagram_username = profile.username  # type: ignore[attr-defined]
    user.instagram_access_token = encrypt_token(long_token)
    user.instagram_token_issued_at = now
    user.instagram_token_expires_at = expires_at
    user.instagram_token_refreshed_at = now


async def revoke_instagram_authorization(db: AsyncSession, instagram_user_id: str) -> bool:
    """Handle a Meta deauthorize webhook: drop the token, kill live sessions.

    Returns True when a matching user was revoked, False when unknown.
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
        pending_edu_email=user.pending_edu_email,
        impersonated_by=uuid.UUID(admin_id) if admin_id else None,
        impersonation_readonly=impersonation_readonly(user) if admin_id else None,
    )


async def issue_token_pair(db: AsyncSession, user: User) -> tuple[str, str]:
    """Bump ``token_version``, then mint ``(access_token, refresh_token)``.

    ``FOR UPDATE`` serializes concurrent mints on the same row and reloads
    ``token_version`` so a waiter cannot both compute ``old+1`` from a stale
    snapshot (auth.ci-session-restore-flake v6).
    """

    await db.refresh(user, with_for_update=True)
    bump_token_version(user)
    await db.flush()
    ver = user.token_version or 0
    access = jwt.create_access_token(user.id, user.portal_role, user.status, token_version=ver)
    refresh = jwt.create_refresh_token(user.id, token_version=ver)
    return access, refresh
