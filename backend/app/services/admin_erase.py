"""Admin hybrid erase for orgs (PRODUCT §3.1.2) and brands (PRODUCT §3.1.3).

Org erase scrubs identity and removes that org from campaign participants
and metric totals. Brand erase scrubs identity and keeps drops and org
campaign history under a tombstone brand name.
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.brand import Brand
from app.models.brand_invite_token import BrandInviteToken
from app.models.enums import BrandStatus, OrgUserStatus, PortalRole
from app.models.organization import Organization
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.security.session import bump_token_version, commit_revocation
from app.services.drop_apply_intents import expire_and_clear_intents_for_org
from app.services.email import (
    KIND_BRAND_ERASED,
    KIND_ORG_ERASED,
    build_idempotency_key,
    send_brand_erased_email,
    send_org_erased_email,
)
from app.services.erased_org_participation import withdraw_org_campaign_participation
from app.services.instagram import canonical_instagram_handle
from app.services.instagram_token import clear_unusable_instagram_token
from app.services.org_apply import clear_ig_bind_mismatch

logger = logging.getLogger(__name__)

_TOMBSTONE_ORG_NAME = "Deleted organization"
_TOMBSTONE_BRAND_NAME = "Deleted brand"


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
        # Re-erase heals seats left behind by the old keep-KPI rule.
        org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
        if org is not None:
            await withdraw_org_campaign_participation(db, org_id=org.id)
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

    if org is not None:
        await expire_and_clear_intents_for_org(db, org.id)
        await withdraw_org_campaign_participation(db, org_id=org.id)
        _scrub_org_profile(org)

    await _delete_user_tokens(db, user.id)
    clear_unusable_instagram_token(user)
    user.instagram_user_id = None
    user.instagram_token_user_id = None
    user.instagram_username = None
    user.edu_email = None
    user.pending_edu_email = None
    user.email_verified_at = None
    user.password_hash = None
    user.status = OrgUserStatus.ERASED.value

    await db.flush()
    await commit_revocation(db)

    email_sent = False
    if notify_email:
        email_sent = await send_org_erased_email(
            notify_email,
            org_name=display_name,
            idempotency_key=build_idempotency_key(KIND_ORG_ERASED, user.id),
        )

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


def _scrub_org_profile(org: Organization) -> None:
    org.org_name = _TOMBSTONE_ORG_NAME
    org.tiktok_handle = None
    org.member_count = None
    org.category = None
    org.city = None
    org.state = None
    org.contact_name = None
    org.delivery_address = None
    org.shipping_line1 = None
    org.shipping_line2 = None
    org.shipping_city = None
    org.shipping_state = None
    org.shipping_postal_code = None
    org.approved_at = None
    org.claimed_instagram_username = None
    org.instagram_handle_confirmed = False
    clear_ig_bind_mismatch(org)
    org.follower_count = None
    # university stays on the admin erased-org record. Brand campus totals
    # count accepted seats, which withdraw already removed.


async def erase_brand(db: AsyncSession, brand_id: UUID, confirm: str) -> dict[str, object]:
    """Erase a brand after company-email confirm. Does not hide drops."""

    brand = await db.get(Brand, brand_id)
    if brand is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Brand not found.", status_code=404)

    if brand.status == BrandStatus.ERASED.value:
        return {
            "brand_id": str(brand.id),
            "status": BrandStatus.ERASED.value,
            "email_sent": False,
            "email_to_domain": None,
        }

    stored = (brand.company_email or "").strip()
    if not stored:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Brand has no company email to confirm erase.",
            status_code=400,
        )
    if stored.casefold() != confirm.strip().casefold():
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Confirmation does not match this brand's company email.",
            status_code=400,
        )

    notify_email = stored
    email_to_domain = _email_domain(notify_email)
    display_name = brand.brand_name
    user = await db.get(User, brand.user_id)
    if user is None or user.portal_role != PortalRole.BRAND.value:
        raise BuzzAPIException(errors.NOT_FOUND, "Brand user not found.", status_code=404)

    await db.execute(delete(BrandInviteToken).where(BrandInviteToken.brand_id == brand.id))
    await _delete_user_tokens(db, user.id)

    brand.brand_name = _TOMBSTONE_BRAND_NAME
    brand.company_email = f"erased+{brand.id.hex}@invalid.local"
    brand.intent_message = None
    brand.instagram_handle = None
    brand.status = BrandStatus.ERASED.value
    brand.approved_at = None

    user.password_hash = None
    user.status = OrgUserStatus.ERASED.value
    bump_token_version(user)

    await db.flush()
    await commit_revocation(db)

    email_sent = await send_brand_erased_email(
        notify_email,
        brand_name=display_name,
        idempotency_key=build_idempotency_key(KIND_BRAND_ERASED, brand.id),
    )
    logger.info(
        "brand_erase_completed brand_id=%s email_sent=%s",
        brand.id,
        email_sent,
    )
    return {
        "brand_id": str(brand.id),
        "status": BrandStatus.ERASED.value,
        "email_sent": email_sent,
        "email_to_domain": email_to_domain,
    }


async def _delete_user_tokens(db: AsyncSession, user_id: UUID) -> None:
    await db.execute(
        delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id)
    )
    await db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id))
