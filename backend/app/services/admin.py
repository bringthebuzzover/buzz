"""Admin orchestration (architecture.md §8.5, §9.2).

Pure service functions (no FastAPI types) the route layer calls.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.brand import Brand
from app.models.drop import Drop
from app.models.enums import (
    BrandStatus,
    BrandTrackerStage,
    OrgUserStatus,
    PortalRole,
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

_ORG_STATUSES = frozenset(member.value for member in OrgUserStatus)
_BRAND_STATUSES = frozenset(member.value for member in BrandStatus)


async def list_orgs(db: AsyncSession, *, status: str | None = None) -> list[dict[str, Any]]:
    """Org users joined to their profile, oldest first.

    ``Organization`` is **outer**-joined so ``pending_org_profile`` users — who
    abandoned onboarding right after the Instagram handshake and have no
    ``organizations`` row — still appear. Their org-side fields come back
    ``None``, which is why callers rendering the narrow pending-queue schema
    filter on ``id``.
    """

    if status is not None and status not in _ORG_STATUSES:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            f"Unknown org status: {status}.",
            status_code=400,
        )

    stmt = (
        select(User, Organization)
        .outerjoin(Organization, Organization.user_id == User.id)
        .where(User.portal_role == PortalRole.ORG.value)
        .order_by(User.created_at.asc())
    )
    if status is not None:
        stmt = stmt.where(User.status == status)

    rows = list(await db.execute(stmt))
    return [
        {
            "id": org.id if org is not None else None,
            "user_id": user.id,
            "org_name": org.org_name if org is not None else None,
            "university": org.university if org is not None else None,
            "instagram_handle": user.instagram_username,
            "follower_count": org.follower_count if org is not None else None,
            "member_count": org.member_count if org is not None else None,
            "category": org.category if org is not None else None,
            "status": user.status,
            "edu_email": user.edu_email,
            "email_verified_at": user.email_verified_at,
            "approved_at": org.approved_at if org is not None else None,
            "last_login_at": user.last_login_at,
            "instagram_token_expires_at": user.instagram_token_expires_at,
            "impersonatable": user.status == OrgUserStatus.ACTIVE.value,
            "created_at": user.created_at,
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

    await send_org_approved_email(user.edu_email or "", org_name=org.org_name)

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

    await send_org_denied_email(user.edu_email or "", org_name=org.org_name)

    return {"org_id": str(org.id), "status": user.status}


async def list_brands(db: AsyncSession, *, status: str | None = None) -> list[dict[str, Any]]:
    """Brands joined to their owning user, oldest first.

    ``user_status`` and ``password_set`` are carried separately from
    ``brands.status`` because ``approve_brand`` leaves the user at
    ``pending_approval`` until the invite is redeemed. Pre-fix denies could
    leave an orphaned ``pending_approval`` user; new denies set both to denied.
    """

    if status is not None and status not in _BRAND_STATUSES:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            f"Unknown brand status: {status}.",
            status_code=400,
        )

    stmt = select(Brand, User).join(User, User.id == Brand.user_id).order_by(Brand.created_at.asc())
    if status is not None:
        stmt = stmt.where(Brand.status == status)

    rows = list(await db.execute(stmt))
    return [
        {
            "id": brand.id,
            "user_id": brand.user_id,
            "brand_name": brand.brand_name,
            "company_email": brand.company_email,
            "intent_message": brand.intent_message,
            "instagram_handle": brand.instagram_handle,
            "status": brand.status,
            "user_status": user.status,
            "password_set": bool(user.password_hash),
            "approved_at": brand.approved_at,
            "last_login_at": user.last_login_at,
            "impersonatable": user.status == OrgUserStatus.ACTIVE.value,
            "created_at": brand.created_at,
        }
        for brand, user in rows
    ]


async def create_brand(
    db: AsyncSession,
    *,
    brand_name: str,
    company_email: str,
    instagram_handle: str | None,
    intent_message: str | None,
    approve_now: bool = False,
) -> dict[str, Any]:
    """Admin-provision a brand account; optionally approve and send the invite."""
    from app.services.brand_auth import apply_brand

    created = await apply_brand(
        db,
        brand_name=brand_name,
        company_email=company_email,
        instagram_handle=instagram_handle,
        intent_message=intent_message,
    )
    brand_id = UUID(created["brand_id"])
    if approve_now:
        return await approve_brand(db, brand_id)
    return created


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
    """Deny a pending brand: set brand + user to denied, then email the brand."""
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
        user.status = OrgUserStatus.DENIED.value
        user.token_version = (user.token_version or 0) + 1  # revoke outstanding sessions
    await db.flush()

    await send_brand_denied_email(brand.company_email, brand_name=brand.brand_name)

    return {"brand_id": str(brand.id), "status": brand.status}


async def undeny_org(db: AsyncSession, org_id: UUID) -> dict[str, Any]:
    """Return a denied org to pending_approval so approve_org can run again."""
    org = await db.get(Organization, org_id)
    if org is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)

    user = await db.get(User, org.user_id)
    if user is None or user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)

    if user.status != OrgUserStatus.DENIED.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Organization is not denied.",
            status_code=400,
        )

    user.status = OrgUserStatus.PENDING_APPROVAL.value
    await db.flush()
    return {"org_id": str(org.id), "status": user.status}


async def undeny_brand(db: AsyncSession, brand_id: UUID) -> dict[str, Any]:
    """Return a denied brand to pending_review so approve_brand can run again."""
    brand = await db.get(Brand, brand_id)
    if brand is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Brand not found.", status_code=404)

    if brand.status != BrandStatus.DENIED.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Brand is not denied.",
            status_code=400,
        )

    brand.status = BrandStatus.PENDING_REVIEW.value
    user = await db.get(User, brand.user_id)
    if user is not None:
        user.status = OrgUserStatus.PENDING_APPROVAL.value
    await db.flush()
    return {"brand_id": str(brand.id), "status": brand.status}


async def resend_brand_invite(db: AsyncSession, brand_id: UUID) -> dict[str, Any]:
    """Re-issue a setup invite for an approved brand that never set a password."""
    brand = await db.get(Brand, brand_id)
    if brand is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Brand not found.", status_code=404)

    if brand.status != BrandStatus.APPROVED.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Brand must be approved to resend an invite.",
            status_code=400,
        )

    user = await db.get(User, brand.user_id)
    if user is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Brand user not found.", status_code=404)

    if user.password_hash is not None:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Brand already set a password; invite is no longer needed.",
            status_code=400,
        )

    from app.services.brand_auth import create_brand_invite

    token = await create_brand_invite(db, brand, user)
    await send_brand_invite_email(brand.company_email, token, brand_name=brand.brand_name)
    return {"brand_id": str(brand.id), "status": brand.status}


async def clear_manual_reopen(db: AsyncSession, drop_id: UUID) -> dict[str, Any]:
    """Clear the permanent reopen flag so drop_autoclose can run again."""
    drop = await db.get(Drop, drop_id)
    if drop is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop not found.", status_code=404)

    drop.manual_reopen = False
    await db.flush()
    return {"drop_id": str(drop.id), "manual_reopen": False}


async def clear_org_instagram_token(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    """Null an org's IG token so get_current_user no longer raises INSTAGRAM_TOKEN_EXPIRED.

    Same field clears as Meta deauthorize, but keyed by Buzz user id and without
    requiring a matching Graph user_id. Status is left alone so a
    pending_email_verification org can reach resend again after reconnecting.
    """
    user = await db.get(User, user_id)
    if user is None or user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization user not found.", status_code=404)

    user.instagram_access_token = None
    user.instagram_token_issued_at = None
    user.instagram_token_expires_at = None
    user.instagram_token_refreshed_at = None
    user.token_version = (user.token_version or 0) + 1
    await db.flush()
    return {"user_id": str(user.id), "instagram_token_cleared": True}


async def set_drop_tracking_number(
    db: AsyncSession, drop_id: UUID, tracking_number: str
) -> dict[str, Any]:
    """Repair tracking on a drop already at or past awaiting_products."""
    drop = await db.get(Drop, drop_id)
    if drop is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop not found.", status_code=404)

    awaiting_idx = _STAGE_ORDER.index(BrandTrackerStage.AWAITING_PRODUCTS.value)
    if _STAGE_ORDER.index(drop.brand_tracker_stage) < awaiting_idx:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Tracking can only be set once the drop has reached awaiting_products.",
            status_code=400,
        )

    cleaned = tracking_number.strip()
    if not cleaned:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "tracking_number must be non-empty.",
            status_code=400,
        )

    drop.tracking_number = cleaned
    await db.flush()
    return {"drop_id": str(drop.id), "tracking_number": drop.tracking_number}


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

    # Applicant selection must happen before any fulfillment stage. Forbid
    # skipping past finalizing_agreements while the drop is unfinalized — a
    # multi-stage jump (e.g. request_received -> drop_active) would otherwise
    # strand applied orgs that can never be decided (finalize requires the
    # finalizing_agreements stage and there is no backward transition).
    finalizing_idx = _STAGE_ORDER.index(BrandTrackerStage.FINALIZING_AGREEMENTS.value)
    if requested_idx > finalizing_idx and drop.applicant_selection_finalized_at is None:
        raise BuzzAPIException(
            errors.DROP_NOT_IN_SELECTION_STAGE,
            "Finalize applicant selection before advancing past the selection stage.",
            status_code=400,
        )

    awaiting = BrandTrackerStage.AWAITING_PRODUCTS.value
    awaiting_idx = _STAGE_ORDER.index(awaiting)
    # Tracking is only writable on the transition *into* awaiting_products, so
    # jumping over that stage (or entering it without a number) permanently
    # strands accepted orgs without a shipment reference.
    if requested_idx > awaiting_idx and current_idx < awaiting_idx:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Advance to awaiting_products with a tracking number before drop_active.",
            status_code=400,
        )
    if requested == awaiting:
        cleaned = (tracking_number or "").strip()
        if not cleaned:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR,
                "tracking_number is required when advancing to awaiting_products.",
                status_code=400,
            )
        tracking_number = cleaned

    drop.brand_tracker_stage = requested
    event = DropTrackerEvent(
        drop_id=drop.id,
        stage=requested,
        note=note,
    )
    db.add(event)

    # At awaiting_products, store the tracking number on the drop (the brand's
    # read-only tracker and org campaign views both read drops.tracking_number).
    if requested == awaiting and tracking_number:
        drop.tracking_number = tracking_number

    await db.flush()
    return {"drop_id": str(drop.id), "stage": drop.brand_tracker_stage}


async def reopen_drop(db: AsyncSession, drop_id: UUID) -> dict[str, Any]:
    """Reopen a drop's apply window (§4.1, §8.5).

    Sets ``manual_reopen=true``. For drops still in selection
    (``request_received`` / ``finalizing_agreements`` / pre-live), also clears
    ``applicant_selection_finalized_at`` and rewinds to ``finalizing_agreements``
    when past it so a new selection round can run.

    Live / finished drops (``drop_active`` / ``drop_finished``) with selection
    already finalized cannot reopen apply — ``apply_to_drop`` / feed treat
    ``applicant_selection_finalized_at`` as closed before ``manual_reopen``, and
    clearing finalize here would risk implying a new selection round while org
    campaigns stay live. Those requests get 409; stage and finalize stay put.
    Unfinalized live / finished drops still get the apply-window flag only.
    """
    drop = await db.get(Drop, drop_id)
    if drop is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop not found.", status_code=404)

    live_or_finished = {
        BrandTrackerStage.DROP_ACTIVE.value,
        BrandTrackerStage.DROP_FINISHED.value,
    }
    if (
        drop.brand_tracker_stage in live_or_finished
        and drop.applicant_selection_finalized_at is not None
    ):
        raise BuzzAPIException(
            errors.ALREADY_FINALIZED,
            "Apply cannot be reopened while applicant selection is finalized "
            "on a live or finished drop.",
            status_code=409,
        )

    drop.manual_reopen = True

    if drop.applicant_selection_finalized_at is not None:
        drop.applicant_selection_finalized_at = None
        finalizing = BrandTrackerStage.FINALIZING_AGREEMENTS.value
        if _STAGE_ORDER.index(drop.brand_tracker_stage) > _STAGE_ORDER.index(finalizing):
            drop.brand_tracker_stage = finalizing
            db.add(
                DropTrackerEvent(
                    drop_id=drop.id,
                    stage=finalizing,
                    note="reopened for a new selection round",
                )
            )
    await db.flush()
    return {"drop_id": str(drop.id), "manual_reopen": True}
