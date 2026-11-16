"""Instagram long-lived token refresh (buzz-ops engineering/architecture.md §10.5).

Long-lived tokens last 60 days and can only be refreshed while still valid. Two
triggers keep them fresh:

* **On-login (primary):** ``maybe_refresh_on_login`` runs inside
  ``get_current_user`` — cheap check, fire-and-forget background refresh when
  within 30 days of expiry, and a hard ``INSTAGRAM_TOKEN_EXPIRED`` once expired.
* **Safety-net cron (backup):** ``refresh_due_tokens`` (see ``app.jobs``) catches
  inactive orgs.

``refresh_instagram_token`` opens its own session (background tasks run after the
request session closes) and takes a per-user advisory lock so two near-
simultaneous logins don't double-refresh.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import set_committed_value

from app import errors
from app.deps.db import async_session_factory
from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus, PortalRole
from app.models.user import User
from app.security.session import bump_token_version
from app.security.token_crypto import TokenDecryptionError, decrypt_token, encrypt_token
from app.services.instagram import InstagramClient, LongLivedToken, get_instagram_client
from app.timeutils import utcnow

logger = logging.getLogger(__name__)

REFRESH_WINDOW_DAYS = 30  # start refreshing this far from expiry (on-login)


def clear_unusable_instagram_token(user: User, *, bump_session: bool = True) -> None:
    """Drop ciphertext that can never be used again (key rotation / corruption).

    Bumps ``token_version`` so outstanding JWTs die the same way logout /
    deauthorize do — the org must reconnect Instagram.
    """

    user.instagram_access_token = None
    user.instagram_token_issued_at = None
    user.instagram_token_expires_at = None
    user.instagram_token_refreshed_at = None
    if bump_session:
        bump_token_version(user)


async def clear_stale_instagram_token(db: AsyncSession, user: User) -> bool:
    """Clear only the identity and ciphertext observed by the failing operation.

    A conditional UPDATE obtains the user lock and rechecks after waiting, so
    delayed cleanup cannot revoke a newly bound account or its Buzz sessions.
    """
    if not user.instagram_access_token:
        return False
    result = await db.execute(
        update(User)
        .where(
            User.id == user.id,
            User.status != OrgUserStatus.ERASED.value,
            User.instagram_user_id == user.instagram_user_id,
            User.instagram_token_user_id == user.instagram_token_user_id,
            User.instagram_access_token == user.instagram_access_token,
        )
        .values(
            instagram_access_token=None,
            instagram_token_issued_at=None,
            instagram_token_expires_at=None,
            instagram_token_refreshed_at=None,
            token_version=func.coalesce(User.token_version, 0) + 1,
        )
        .returning(User.token_version)
        .execution_options(synchronize_session=False)
    )
    version = result.scalar_one_or_none()
    if version is None:
        return False
    # On-login cleanup uses a separate transaction. Reflect its successful CAS
    # without leaving dirty fields in the request session that could later flush
    # over another account's bind.
    for field in (
        "instagram_access_token",
        "instagram_token_issued_at",
        "instagram_token_expires_at",
        "instagram_token_refreshed_at",
    ):
        set_committed_value(user, field, None)
    set_committed_value(user, "token_version", version)
    return True


def time_until_expiry(user: User, *, now: datetime | None = None) -> timedelta | None:
    """Remaining time until the user's IG token expires, or None if not applicable."""
    if user.portal_role != PortalRole.ORG.value or not user.instagram_access_token:
        return None
    if user.instagram_token_expires_at is None:
        return None
    exp = user.instagram_token_expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return exp - (now or utcnow())


async def maybe_refresh_on_login(
    user: User,
    background_tasks: BackgroundTasks | None,
    ig: InstagramClient,
) -> None:
    """On-login check (§10.5.1). Enqueue a refresh near expiry; raise once expired.

    A no-op for non-org users and orgs without an IG token. Never blocks the
    request — the refresh itself runs as a background task. Undecryptable
    ciphertext (e.g. after ``TOKEN_ENCRYPTION_KEY`` rotation) is cleared in a
    dedicated session (request ``get_db`` would roll back on the 401) and
    surfaced as ``INSTAGRAM_TOKEN_EXPIRED`` so the org must reconnect.
    """
    if user.portal_role != PortalRole.ORG.value or not user.instagram_access_token:
        return
    try:
        decrypt_token(user.instagram_access_token)
    except TokenDecryptionError:
        logger.warning(
            "clearing undecryptable Instagram token for user %s",
            user.id,
        )
        async with async_session_factory() as clear_db:
            await clear_stale_instagram_token(clear_db, user)
            await clear_db.commit()
        raise BuzzAPIException(
            code=errors.INSTAGRAM_TOKEN_EXPIRED,
            message="Your Instagram connection has expired. Please reconnect.",
            status_code=401,
        ) from None

    remaining = time_until_expiry(user)
    if remaining is None:
        return
    if remaining <= timedelta(0):
        logger.warning(
            "clearing clock-expired Instagram token for user %s",
            user.id,
        )
        async with async_session_factory() as clear_db:
            await clear_stale_instagram_token(clear_db, user)
            await clear_db.commit()
        raise BuzzAPIException(
            code=errors.INSTAGRAM_TOKEN_EXPIRED,
            message="Your Instagram connection has expired. Please reconnect.",
            status_code=401,
        )
    if remaining < timedelta(days=REFRESH_WINDOW_DAYS) and background_tasks is not None:
        background_tasks.add_task(refresh_instagram_token, user.id)


async def store_refreshed_instagram_token(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    expected_identity: tuple[str | None, str | None],
    expected_token: str,
    token: LongLivedToken,
    now: datetime,
) -> bool:
    """Rotate only credentials that still belong to the account Graph refreshed."""
    updated_id = await db.scalar(
        update(User)
        .where(
            User.id == user_id,
            User.status != OrgUserStatus.ERASED.value,
            User.instagram_user_id == expected_identity[0],
            User.instagram_token_user_id == expected_identity[1],
            User.instagram_access_token == expected_token,
        )
        .values(
            instagram_access_token=encrypt_token(token.access_token),
            instagram_token_issued_at=now,
            instagram_token_expires_at=now + timedelta(seconds=token.expires_in),
            instagram_token_refreshed_at=now,
        )
        .returning(User.id)
        .execution_options(synchronize_session="fetch")
    )
    if updated_id is None:
        logger.info("Discarding stale Instagram token refresh for user %s", user_id)
        return False
    return True


async def refresh_instagram_token(user_id: uuid.UUID) -> bool:
    """Background-safe refresh for one user. Returns True if the token was rotated.

    Failures are swallowed (logged): the existing token is still valid for up to
    REFRESH_WINDOW_DAYS more, and the next login retries. Undecryptable
    ciphertext is cleared so the org is forced to reconnect. An erased account
    is skipped, including when erase commits while the Graph call is in flight,
    so a refresh cannot write a token back onto the tombstone.
    """
    ig = get_instagram_client()
    async with async_session_factory() as db:
        # Per-user advisory lock so concurrent logins don't double-refresh; the
        # loser just returns. Lock is held for the transaction.
        locked = await db.scalar(
            select(func.pg_try_advisory_xact_lock(func.hashtext(str(user_id))))
        )
        if not locked:
            return False

        user = await db.get(User, user_id)
        if (
            user is None
            or user.status == OrgUserStatus.ERASED.value
            or not user.instagram_access_token
        ):
            return False
        previous_identity = (user.instagram_user_id, user.instagram_token_user_id)
        previous_token = user.instagram_access_token
        try:
            current = decrypt_token(user.instagram_access_token)
            new = await ig.refresh_long_lived(current)
        except TokenDecryptionError:
            logger.warning(
                "clearing undecryptable Instagram token for user %s",
                user_id,
            )
            await clear_stale_instagram_token(db, user)
            await db.commit()
            return False
        except Exception:  # noqa: BLE001 — best-effort; keep the old token
            logger.warning(
                "Instagram token refresh failed for user %s",
                user_id,
                exc_info=False,
            )
            return False

        rotated = await store_refreshed_instagram_token(
            db,
            user_id=user_id,
            expected_identity=previous_identity,
            expected_token=previous_token,
            token=new,
            now=utcnow(),
        )
        await db.commit()
        return rotated
