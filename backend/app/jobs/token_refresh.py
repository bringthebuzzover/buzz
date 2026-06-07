"""Instagram token refresh safety-net cron (architecture.md §10.5.2).

Daily. Catches *inactive* orgs the on-login refresh (§10.5.1) misses: refreshes
long-lived tokens in the safe window (expiring within 14 days but not yet
expired). Per-user failures don't block the batch — the old token stays valid
and the next run retries.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.security.token_crypto import decrypt_token, encrypt_token
from app.services.instagram import InstagramClient

logger = logging.getLogger(__name__)

_SAFE_MIN = timedelta(days=1)  # don't bother if it expires within a day...
_SAFE_MAX = timedelta(days=14)  # ...but do refresh if within two weeks


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
    for user in users:
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
    return {"candidates": len(users), "refreshed": refreshed, "failed": failed}
