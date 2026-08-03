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
            "instagram_handle": (
                org.instagram_handle if org is not None else user.instagram_username
            ),
            "follower_count": org.follower_count if org is not None else None,
            "member_count": org.member_count if org is not None else None,
            "category": org.category if org is not None else None,
            "status": user.status,
            "edu_email": org.edu_email if org is not None else user.edu_email,
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


async def list_brands(db: AsyncSession, *, status: str | None = None) -> list[dict[str, Any]]:
    """Brands joined to their owning user, oldest first.

    ``user_status`` and ``password_set`` are carried separately from
    ``brands.status`` because the two disagree on purpose: ``approve_brand``
    leaves the user at ``pending_approval`` until the invite is redeemed, and
    ``deny_brand`` never touches the user at all. Together the three fields
    distinguish live, invite-never-redeemed, and denied-with-orphan-user.
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

    drop.brand_tracker_stage = requested
    event = DropTrackerEvent(
        drop_id=drop.id,
        stage=requested,
        note=note,
    )
    db.add(event)

    # At awaiting_products, store the tracking number on the drop (the brand's
    # read-only tracker shows it here, §5.2) and mirror it onto accepted
    # applications (the org-facing campaign view, §6.4.1).
    if requested == BrandTrackerStage.AWAITING_PRODUCTS.value and tracking_number:
        drop.tracking_number = tracking_number
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
    """Reopen a drop's apply window (§4.1, §8.5).

    Always re-opens the apply window (``manual_reopen=true``). If the drop was
    already **finalized**, also re-enables a new selection round so the orgs that
    apply after reopen aren't stranded: clear ``applicant_selection_finalized_at``
    and move the tracker back to ``finalizing_agreements`` (the one controlled
    backward transition), writing a tracker event. Previously-``accepted`` orgs
    keep their decision (finalize only re-touches ``applied`` rows).

    Note (reopen UX is PRODUCT.md §12 TBD): capacity is not re-checked across
    rounds, and finalize still keys off ``apply_close_at`` — an org applying
    during a brand's finalize is a benign TOCTOU. Both are acceptable for the MVP
    admin-driven flow.
    """
    drop = await db.get(Drop, drop_id)
    if drop is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop not found.", status_code=404)

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
