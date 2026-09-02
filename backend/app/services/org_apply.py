"""Public org apply (LAUNCH.md Phase A) — create account without Instagram OAuth."""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus, PortalRole
from app.models.organization import Organization
from app.models.user import User
from app.schemas.onboarding import OrgApplyRequest
from app.services.address import AddressClient, apply_to_org
from app.services.instagram import canonical_instagram_handle
from app.services.onboarding import _mint_and_send_verification, _release_unverified_edu_claim
from app.services.org_apply_prefill import mark_prefill_used

logger = logging.getLogger(__name__)

# Instagram username: 1–30 chars, letters/digits/._ ; not starting/ending with .
_HANDLE_RE = re.compile(r"^(?!.*\.\.)(?!\.)[A-Za-z0-9._]{1,30}(?<!\.)$")


def normalize_claimed_handle(raw: str) -> str:
    handle = canonical_instagram_handle(raw)
    if not handle or not _HANDLE_RE.match(handle):
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Enter a valid Instagram username (letters, numbers, periods, underscores).",
            status_code=400,
        )
    return handle


async def assert_handle_available(
    db: AsyncSession,
    handle: str,
    *,
    exclude_user_id: uuid.UUID | None = None,
) -> None:
    """Claimed @handle unique among non-erased orgs (case-insensitive)."""
    stmt = select(User).where(
        User.portal_role == PortalRole.ORG.value,
        User.status != OrgUserStatus.ERASED.value,
        func.lower(User.instagram_username) == handle.lower(),
    )
    if exclude_user_id is not None:
        stmt = stmt.where(User.id != exclude_user_id)
    existing = await db.scalar(stmt)
    if existing is not None:
        raise BuzzAPIException(
            errors.INSTAGRAM_HANDLE_TAKEN,
            "That Instagram handle is already claimed by another organization.",
            status_code=409,
        )


async def apply_org(
    db: AsyncSession, payload: OrgApplyRequest, addresses: AddressClient
) -> dict[str, Any]:
    """Create User + Organization without IG token; mint .edu verify email."""
    handle = normalize_claimed_handle(payload.instagram_handle)
    user_id = uuid.uuid4()

    await _release_unverified_edu_claim(db, claimant_id=user_id, edu_email=payload.edu_email)
    await assert_handle_available(db, handle)

    user = User(
        id=user_id,
        portal_role=PortalRole.ORG.value,
        status=OrgUserStatus.PENDING_EMAIL_VERIFICATION.value,
        edu_email=payload.edu_email,
        instagram_username=handle,
    )
    addr = await addresses.validate(
        line1=payload.shipping_line1,
        line2=payload.shipping_line2,
        city=payload.shipping_city,
        state=payload.shipping_state,
        postal_code=payload.shipping_postal_code,
        place_id=payload.shipping_place_id,
    )
    org = Organization(
        id=uuid.uuid4(),
        user_id=user.id,
        org_name=payload.org_name,
        university=payload.university,
        tiktok_handle=payload.tiktok_handle,
        follower_count=None,
        member_count=payload.member_count,
        category=payload.category.value,
        city=payload.city,
        state=payload.state,
        contact_name=payload.contact_name,
        instagram_handle_confirmed=payload.handle_confirmed,
    )
    apply_to_org(org, addr)
    db.add(user)
    await db.flush()
    db.add(org)

    try:
        await db.flush()
    except IntegrityError as exc:
        detail = str(exc.orig).lower()
        if "edu_email" in detail:
            raise BuzzAPIException(
                errors.EDU_EMAIL_TAKEN,
                "This .edu email is already associated with another account.",
                status_code=409,
            ) from exc
        raise

    email_sent = await _mint_and_send_verification(
        db,
        user,
        payload.edu_email,
        org_name=payload.org_name,
        kind="signup",
    )
    await mark_prefill_used(db, payload.prefill_token, user.id)

    return {
        "org_id": str(org.id),
        "status": user.status,
        "email_sent_to": payload.edu_email,
        "email_sent": email_sent,
    }
