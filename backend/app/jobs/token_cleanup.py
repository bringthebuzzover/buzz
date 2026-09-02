"""Token cleanup job (architecture.md §10.3).

Daily. Deletes spent (used or expired) email-verification, brand-invite,
org-connect, org-apply-prefill, and password-reset tokens after a grace period.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand_invite_token import BrandInviteToken
from app.models.org_apply_prefill import OrgApplyPrefill
from app.models.org_connect_token import OrgConnectToken
from app.models.password_reset_token import PasswordResetToken
from app.models.verification_token import EmailVerificationToken

# Exported for admin health (must stay aligned with the cleanup job).
DEFAULT_GRACE_DAYS = 7


async def cleanup_tokens(
    db: AsyncSession, *, grace_days: int = DEFAULT_GRACE_DAYS
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=grace_days)

    # A token is sweepable when it's been used, or it expired — but only once the
    # grace window has passed (used_at/expires_at older than the cutoff).
    verif = await db.execute(
        delete(EmailVerificationToken).where(
            or_(
                EmailVerificationToken.used_at < cutoff,
                EmailVerificationToken.expires_at < cutoff,
            )
        )
    )
    invites = await db.execute(
        delete(BrandInviteToken).where(
            or_(
                BrandInviteToken.used_at < cutoff,
                BrandInviteToken.expires_at < cutoff,
            )
        )
    )
    connects = await db.execute(
        delete(OrgConnectToken).where(
            or_(
                OrgConnectToken.used_at < cutoff,
                OrgConnectToken.expires_at < cutoff,
            )
        )
    )
    prefills = await db.execute(
        delete(OrgApplyPrefill).where(
            or_(
                OrgApplyPrefill.used_at < cutoff,
                OrgApplyPrefill.expires_at < cutoff,
            )
        )
    )
    resets = await db.execute(
        delete(PasswordResetToken).where(
            or_(
                PasswordResetToken.used_at < cutoff,
                PasswordResetToken.expires_at < cutoff,
            )
        )
    )

    await db.flush()
    return {
        "verification_tokens_deleted": getattr(verif, "rowcount", 0) or 0,
        "brand_invite_tokens_deleted": getattr(invites, "rowcount", 0) or 0,
        "org_connect_tokens_deleted": getattr(connects, "rowcount", 0) or 0,
        "org_apply_prefills_deleted": getattr(prefills, "rowcount", 0) or 0,
        "password_reset_tokens_deleted": getattr(resets, "rowcount", 0) or 0,
    }
