"""Admin orchestration (architecture.md §8.5, §9.2).

Pure service functions (no FastAPI types) the route layer calls.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.brand import Brand
from app.models.drop import Drop
from app.models.enums import (
    ApplicationDecision,
    BrandStatus,
    BrandTrackerStage,
    OrgUserStatus,
)
from app.models.organization import Organization
from app.models.tracker_event import DropTrackerEvent
from app.models.user import User
from app.services.email import (
    send_brand_denied_email,
    send_brand_invite_email,
    send_org_approved_email,
    send_org_denied_email,
)

_STAGE_ORDER = [
    BrandTrackerStage.REQUEST_RECEIVED.value,
    BrandTrackerStage.FINALIZING_AGREEMENTS.value,
    BrandTrackerStage.AWAITING_PRODUCTS.value,
    BrandTrackerStage.DROP_ACTIVE.value,
    BrandTrackerStage.DROP_FINISHED.value,
]


async def list_pending_orgs(db: AsyncSession) -> list[dict[str, Any]]:
    """Return all org users with ``status=pending_approval`` joined to their profile."""
    rows = list(
        await db.execute(
            select(User, Organization)
            .join(Organization, Organization.user_id == User.id)
            .where(
                User.portal_role == "org",
                User.status == OrgUserStatus.PENDING_APPROVAL.value,
            )
            .order_by(User.created_at.asc())
        )
    )
    return [
        {
            "id": org.id,
            "user_id": user.id,
            "org_name": org.org_name,
            "university": org.university,
            "instagram_handle": org.instagram_handle,
            "follower_count": org.follower_count,
            "member_count": org.member_count,
            "status": user.status,
            "created_at": org.created_at,
        }
        for user, org in rows
    ]


async def approve_org(db: AsyncSession, org_id: UUID) -> dict[str, Any]:
    """Approve a pending org: set user.active + org.approved_at=now."""
    org = await db.get(Organization, org_id)
    if org is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)

    user = await db.get(User, org.user_id)
    if user is None or user.portal_role != "org":
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)

    if user.status != OrgUserStatus.PENDING_APPROVAL.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Organization is not in a pending-approval state.",
            status_code=400,
        )

    now = datetime.now(timezone.utc)
    user.status = OrgUserStatus.ACTIVE.value
    org.approved_at = now
    await db.flush()

    await send_org_approved_email(org.edu_email, org_name=org.org_name)

    return {"org_id": str(org.id), "status": user.status}


async def deny_org(db: AsyncSession, org_id: UUID) -> dict[str, Any]:
    """Deny a pending org: set user.status=denied."""
    org = await db.get(Organization, org_id)
    if org is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)

    user = await db.get(User, org.user_id)
    if user is None or user.portal_role != "org":
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)

    if user.status != OrgUserStatus.PENDING_APPROVAL.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Organization is not in a pending-approval state.",
            status_code=400,
        )

    user.status = OrgUserStatus.DENIED.value
    user.token_version = (user.token_version or 0) + 1  # revoke outstanding sessions
    await db.flush()

    await send_org_denied_email(org.edu_email, org_name=org.org_name)

    return {"org_id": str(org.id), "status": user.status}


async def list_pending_brands(db: AsyncSession) -> list[dict[str, Any]]:
    """Return all brands with ``status=pending_review``."""
    rows = list(
        await db.scalars(
            select(Brand)
            .where(Brand.status == BrandStatus.PENDING_REVIEW.value)
            .order_by(Brand.created_at.asc())
        )
    )
    return [
        {
            "id": brand.id,
            "user_id": brand.user_id,
            "brand_name": brand.brand_name,
            "company_email": brand.company_email,
            "intent_message": brand.intent_message,
            "instagram_handle": brand.instagram_handle,
            "status": brand.status,
            "created_at": brand.created_at,
        }
        for brand in rows
    ]


async def approve_brand(db: AsyncSession, brand_id: UUID) -> dict[str, Any]:
    """Approve a pending brand, create an invite token, and send the setup email."""
    brand = await db.get(Brand, brand_id)
    if brand is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Brand not found.", status_code=404)

    if brand.status != BrandStatus.PENDING_REVIEW.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Brand is not in a pending-review state.",
            status_code=400,
        )

    user = await db.get(User, brand.user_id)
    if user is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Brand user not found.", status_code=404)

    now = datetime.now(timezone.utc)
    brand.status = BrandStatus.APPROVED.value
    brand.approved_at = now
    await db.flush()

    # Generate invite token and send the setup email (Stage 7).
    from app.services.brand_auth import create_brand_invite

    token = await create_brand_invite(db, brand, user)
    await send_brand_invite_email(brand.company_email, token, brand_name=brand.brand_name)

    return {"brand_id": str(brand.id), "status": brand.status}


async def deny_brand(db: AsyncSession, brand_id: UUID) -> dict[str, Any]:
    """Deny a pending brand: set brand.status=denied + email the brand."""
    brand = await db.get(Brand, brand_id)
    if brand is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Brand not found.", status_code=404)

    if brand.status != BrandStatus.PENDING_REVIEW.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Brand is not in a pending-review state.",
            status_code=400,
        )

    brand.status = BrandStatus.DENIED.value
    user = await db.get(User, brand.user_id)
    if user is not None:
        user.token_version = (user.token_version or 0) + 1  # revoke outstanding sessions
    await db.flush()

    await send_brand_denied_email(brand.company_email, brand_name=brand.brand_name)

    return {"brand_id": str(brand.id), "status": brand.status}


async def advance_tracker(
    db: AsyncSession,
    drop_id: UUID,
    stage: str,
    *,
    tracking_number: str | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    """Advance a drop's tracker stage (forward-only state machine, §8.5)."""
    drop = await db.get(Drop, drop_id)
    if drop is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop not found.", status_code=404)

    current = drop.brand_tracker_stage
    requested = stage

    if requested not in _STAGE_ORDER:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            f"Invalid tracker stage: {requested}.",
            status_code=400,
        )

    current_idx = _STAGE_ORDER.index(current)
    requested_idx = _STAGE_ORDER.index(requested)

    if requested_idx <= current_idx:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            f"Cannot move tracker backwards (current: {current}, requested: {requested}).",
            status_code=400,
        )

    drop.brand_tracker_stage = requested
    event = DropTrackerEvent(
        drop_id=drop.id,
        stage=requested,
        note=note,
    )
    db.add(event)

    # At awaiting_products, mirror tracking_number onto accepted applications
    if requested == BrandTrackerStage.AWAITING_PRODUCTS.value and tracking_number:
        await db.execute(
            sa_update(DropApplication)
            .where(
                DropApplication.drop_id == drop.id,
                DropApplication.decision == ApplicationDecision.ACCEPTED.value,
            )
            .values(tracking_number=tracking_number)
        )

    await db.flush()
    return {"drop_id": str(drop.id), "stage": drop.brand_tracker_stage}


async def reopen_drop(db: AsyncSession, drop_id: UUID) -> dict[str, Any]:
    """Set ``manual_reopen=true`` on a drop (§8.5)."""
    drop = await db.get(Drop, drop_id)
    if drop is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop not found.", status_code=404)

    drop.manual_reopen = True
    await db.flush()
    return {"drop_id": str(drop.id), "manual_reopen": True}
