"""Admin org hybrid erase (PRODUCT.md §3.1.2 / §4.3).

Scrubs identity and identifiable post content; keeps campaign KPI contribution
(posts, links, metrics, follower_count, university, accepted seats).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.enums import ApplicationDecision, OrgUserStatus, PortalRole
from app.models.notify_me import NotifyMe
from app.models.organization import Organization
from app.models.password_reset_token import PasswordResetToken
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.social_post import SocialPost
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.services.email import send_org_erased_email
from app.services.instagram import canonical_instagram_handle
from app.services.instagram_token import clear_unusable_instagram_token

logger = logging.getLogger(__name__)

_TOMBSTONE_ORG_NAME = "Deleted organization"


def _email_domain(email: str | None) -> str | None:
    if not email or "@" not in email:
        return None
    return email.rsplit("@", 1)[-1].lower()


async def erase_org_user(db: AsyncSession, user_id: UUID, confirm: str) -> dict[str, object]:
    """Erase an org account after IG-handle confirm. Idempotent when already erased."""

    user = await db.get(User, user_id)
    if user is None or user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization user not found.", status_code=404)

    if user.status == OrgUserStatus.ERASED.value:
        return {
            "user_id": str(user.id),
            "status": OrgUserStatus.ERASED.value,
            "email_sent": False,
            "email_to_domain": None,
        }

    stored_handle = canonical_instagram_handle(user.instagram_username)
    if not stored_handle:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Organization has no Instagram handle to confirm erase.",
            status_code=400,
        )
    if canonical_instagram_handle(confirm).casefold() != stored_handle.casefold():
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Confirmation does not match this organization's Instagram handle.",
            status_code=400,
        )

    notify_email = (user.edu_email or "").strip() or None
    email_to_domain = _email_domain(notify_email)

    org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
    display_name = org.org_name if org is not None else stored_handle

    now = datetime.now(timezone.utc)
    if org is not None:
        await _auto_deny_applied(db, org.id, now)
        await _scrub_posts(db, org.id)
        await _delete_org_side_rows(db, org.id)
        _scrub_org_profile(org)
        await _scrub_application_pitches(db, org.id)

    await _delete_user_tokens(db, user.id)
    clear_unusable_instagram_token(user)
    user.instagram_user_id = None
    user.instagram_token_user_id = None
    user.instagram_username = None
    user.edu_email = None
    user.email_verified_at = None
    user.password_hash = None
    user.status = OrgUserStatus.ERASED.value

    await db.flush()

    email_sent = False
    if notify_email:
        email_sent = await send_org_erased_email(notify_email, org_name=display_name)

    logger.info(
        "org_erase_completed user_id=%s email_sent=%s",
        user.id,
        email_sent,
    )
    return {
        "user_id": str(user.id),
        "status": OrgUserStatus.ERASED.value,
        "email_sent": email_sent,
        "email_to_domain": email_to_domain if email_sent or notify_email else None,
    }


async def _auto_deny_applied(db: AsyncSession, org_id: UUID, now: datetime) -> None:
    await db.execute(
        update(DropApplication)
        .where(
            DropApplication.org_id == org_id,
            DropApplication.decision == ApplicationDecision.APPLIED.value,
        )
        .values(decision=ApplicationDecision.DENIED.value, decision_at=now)
    )


async def _scrub_posts(db: AsyncSession, org_id: UUID) -> None:
    posts = list(await db.scalars(select(SocialPost).where(SocialPost.org_id == org_id)))
    for post in posts:
        post.external_id = f"erased-{post.id}"
        post.url = f"erased://post/{post.id}"
        post.caption = "[removed]"
        post.media_url = None
        post.thumbnail_url = None
        post.insights_raw = None


async def _delete_org_side_rows(db: AsyncSession, org_id: UUID) -> None:
    app_ids = list(
        await db.scalars(select(DropApplication.id).where(DropApplication.org_id == org_id))
    )
    post_ids = list(await db.scalars(select(SocialPost.id).where(SocialPost.org_id == org_id)))
    sug_conds = []
    if app_ids:
        sug_conds.append(PostCampaignSuggestion.application_id.in_(app_ids))
    if post_ids:
        sug_conds.append(PostCampaignSuggestion.post_id.in_(post_ids))
    if sug_conds:
        await db.execute(delete(PostCampaignSuggestion).where(or_(*sug_conds)))
    await db.execute(delete(NotifyMe).where(NotifyMe.org_id == org_id))
    # Links intentionally kept for KPI retention (PRODUCT §4.3).


async def _scrub_application_pitches(db: AsyncSession, org_id: UUID) -> None:
    await db.execute(
        update(DropApplication).where(DropApplication.org_id == org_id).values(pitch=None)
    )


def _scrub_org_profile(org: Organization) -> None:
    org.org_name = _TOMBSTONE_ORG_NAME
    org.tiktok_handle = None
    org.member_count = None
    org.category = None
    org.city = None
    org.state = None
    org.contact_name = None
    org.delivery_address = None
    org.approved_at = None
    # Keep follower_count and university for brand reach / campus KPIs.


async def _delete_user_tokens(db: AsyncSession, user_id: UUID) -> None:
    await db.execute(
        delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id)
    )
    await db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id))
