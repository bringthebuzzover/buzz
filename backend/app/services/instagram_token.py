"""Instagram long-lived token refresh (architecture.md §10.5).

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
from sqlalchemy import func, select

from app import errors
from app.deps.db import async_session_factory
from app.exceptions import BuzzAPIException
from app.models.user import User
from app.security.token_crypto import decrypt_token, encrypt_token
from app.services.instagram import InstagramClient, get_instagram_client

logger = logging.getLogger(__name__)

REFRESH_WINDOW_DAYS = 30  # start refreshing this far from expiry (on-login)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def time_until_expiry(user: User, *, now: datetime | None = None) -> timedelta | None:
    """Remaining time until the user's IG token expires, or None if not applicable."""
    if user.portal_role != "org" or not user.instagram_access_token:
        return None
    if user.instagram_token_expires_at is None:
        return None
    exp = user.instagram_token_expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return exp - (now or _now())


def days_until_expiry(user: User, *, now: datetime | None = None) -> int | None:
    """Whole days of remaining IG token lifetime (floor), or None if not applicable.

    Prefer :func:`time_until_expiry` for expiry decisions — a token with 12 hours
    left has ``days_until_expiry == 0`` but is still valid.
    """
    remaining = time_until_expiry(user, now=now)
    if remaining is None:
        return None
    return int(remaining.total_seconds() // 86400)


def maybe_refresh_on_login(
    user: User,
    background_tasks: BackgroundTasks | None,
    ig: InstagramClient,
) -> None:
    """On-login check (§10.5.1). Enqueue a refresh near expiry; raise once expired.

    A no-op for non-org users and orgs without an IG token. Never blocks the
    request — the refresh itself runs as a background task.
    """
    remaining = time_until_expiry(user)
    if remaining is None:
        return
    if remaining <= timedelta(0):
        raise BuzzAPIException(
            code=errors.INSTAGRAM_TOKEN_EXPIRED,
            message="Your Instagram connection has expired. Please reconnect.",
            status_code=401,
        )
    if remaining < timedelta(days=REFRESH_WINDOW_DAYS) and background_tasks is not None:
        background_tasks.add_task(refresh_instagram_token, user.id)


async def refresh_instagram_token(user_id: uuid.UUID) -> bool:
    """Background-safe refresh for one user. Returns True if the token was rotated.

    Failures are swallowed (logged): the existing token is still valid for up to
    REFRESH_WINDOW_DAYS more, and the next login retries.
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
        if user is None or not user.instagram_access_token:
            return False
        try:
            current = decrypt_token(user.instagram_access_token)
            new = await ig.refresh_long_lived(current)
        except Exception:  # noqa: BLE001 — best-effort; keep the old token
            logger.warning("Instagram token refresh failed for user %s", user_id, exc_info=True)
            return False

        now = _now()
        user.instagram_access_token = encrypt_token(new.access_token)
        user.instagram_token_issued_at = now
        user.instagram_token_expires_at = now + timedelta(seconds=new.expires_in)
        user.instagram_token_refreshed_at = now
        await db.commit()
        return True
