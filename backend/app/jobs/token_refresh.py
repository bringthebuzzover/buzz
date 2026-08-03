"""Instagram token refresh safety-net cron (architecture.md §10.5.2).

Daily. Catches *inactive* orgs the on-login refresh (§10.5.1) misses: refreshes
long-lived tokens in the safe window (still valid, expiring within 14 days).
Per-user failures don't block the batch — the old token stays valid and the
next run retries.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.security.token_crypto import decrypt_token, encrypt_token
from app.services.instagram import InstagramClient

logger = logging.getLogger(__name__)

_SAFE_MIN = timedelta(0)  # include the last day; Meta tokens refresh while still valid
_SAFE_MAX = timedelta(days=14)  # refresh if within two weeks


async def refresh_due_tokens(db: AsyncSession, ig: InstagramClient) -> dict[str, Any]:
    now = datetime.now(timezone.utc)

    users = list(
        await db.scalars(
            select(User).where(
                User.portal_role == "org",
                User.instagram_access_token.isnot(None),
                User.instagram_token_expires_at.isnot(None),
                User.instagram_token_expires_at > now + _SAFE_MIN,
                User.instagram_token_expires_at < now + _SAFE_MAX,
            )
        )
    )

    refreshed = 0
    failed = 0
    skipped = 0
    for user in users:
        # Per-user advisory lock keyed identically to the on-login path
        # (services.instagram_token) so the cron and a concurrent login — or a
        # second cron run — can't double-refresh the same user. Non-blocking: a
        # contended user is skipped this run and retried next time. Held for the
        # job's transaction.
        locked = await db.scalar(
            select(func.pg_try_advisory_xact_lock(func.hashtext(str(user.id))))
        )
        if not locked:
            skipped += 1
            continue
        try:
            assert user.instagram_access_token is not None
            new = await ig.refresh_long_lived(decrypt_token(user.instagram_access_token))
        except Exception:  # noqa: BLE001 — keep the old token, count, continue
            logger.warning("Token refresh failed for user %s", user.id, exc_info=True)
            failed += 1
            continue
        user.instagram_access_token = encrypt_token(new.access_token)
        user.instagram_token_issued_at = now
        user.instagram_token_expires_at = now + timedelta(seconds=new.expires_in)
        user.instagram_token_refreshed_at = now
        refreshed += 1

    await db.flush()
    return {
        "candidates": len(users),
        "refreshed": refreshed,
        "failed": failed,
        "skipped": skipped,
    }
