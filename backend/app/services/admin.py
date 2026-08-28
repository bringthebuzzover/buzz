"""Admin orchestration (architecture.md §8.5, §9.2).

Pure service functions (no FastAPI types) the route layer calls.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.brand import Brand
from app.models.drop import Drop
from app.models.drop_request import DropRequest
from app.models.enums import (
    ApplicationDecision,
    BrandStatus,
    BrandTrackerStage,
    OrgUserStatus,
    PortalRole,
)
from app.models.notify_me import NotifyMe
from app.models.organization import Organization
from app.models.tracker_event import DropTrackerEvent
from app.models.user import User
from app.schemas.admin import AdminDropConfigPatch, AdminDropCreateRequest
from app.security.session import bump_token_version
from app.services.drop_requests import touch_updated_at
from app.services.email import (
    send_brand_denied_email,
    send_brand_invite_email,
    send_brand_undenied_email,
    send_drop_published_email,
    send_org_approved_email,
    send_org_denied_email,
    send_org_undenied_email,
)
from app.services.instagram_token import clear_unusable_instagram_token
from app.services.org_connect import create_org_connect_token

logger = logging.getLogger(__name__)

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
    else:
        # All filter excludes erased tombstones (PRODUCT §3.1.2); use ?status=erased.
        stmt = stmt.where(User.status != OrgUserStatus.ERASED.value)

    rows = list(await db.execute(stmt))
    return [
        {
            "id": org.id if org is not None else None,
            "user_id": user.id,
            "org_name": org.org_name if org is not None else None,
            "university": org.university if org is not None else None,
            "instagram_handle": user.instagram_username,
            "instagram_handle_confirmed": (
                org.instagram_handle_confirmed if org is not None else False
            ),
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


def _refuse_erased_org(user: User) -> None:
    if user.status == OrgUserStatus.ERASED.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Organization account has been erased.",
            status_code=409,
        )


async def approve_org(
    db: AsyncSession,
    org_id: UUID,
    *,
    tester_invite_confirmed: bool = False,
) -> dict[str, Any]:
    """Approve a pending org → pending_instagram (or active if IG already bound)."""
    org = await db.get(Organization, org_id)
    if org is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)

    user = await db.get(User, org.user_id)
    if user is None or user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)

    _refuse_erased_org(user)
    if user.status != OrgUserStatus.PENDING_APPROVAL.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Organization is not in a pending-approval state.",
            status_code=400,
        )

    if not tester_invite_confirmed:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Confirm you added this org as an Instagram Tester before approving.",
            status_code=400,
        )

    now = datetime.now(timezone.utc)
    org.approved_at = now

    # Legacy mid-flight: Graph ids + token already on file → skip Connect.
    already_bound = bool(user.instagram_user_id and user.instagram_access_token)
    connect_token: str | None = None
    if already_bound:
        user.status = OrgUserStatus.ACTIVE.value
        await db.flush()
        await send_org_approved_email(user.edu_email or "", org_name=org.org_name)
    else:
        user.status = OrgUserStatus.PENDING_INSTAGRAM.value
        connect_token = await create_org_connect_token(db, org, user)
        await db.flush()
        await send_org_approved_email(
            user.edu_email or "",
            org_name=org.org_name,
            connect_token=connect_token,
        )

    return {"org_id": str(org.id), "status": user.status}


async def resend_org_connect(db: AsyncSession, org_id: UUID) -> dict[str, Any]:
    """Mint a fresh connect token and email it (pending_instagram only)."""
    org = await db.get(Organization, org_id)
    if org is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)

    user = await db.get(User, org.user_id)
    if user is None or user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)

    _refuse_erased_org(user)
    if user.status != OrgUserStatus.PENDING_INSTAGRAM.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Organization is not waiting to connect Instagram.",
            status_code=400,
        )

    raw = await create_org_connect_token(db, org, user)
    await db.flush()
    email_sent = await send_org_approved_email(
        user.edu_email or "",
        org_name=org.org_name,
        connect_token=raw,
    )
    return {"org_id": str(org.id), "status": user.status, "email_sent": email_sent}


async def deny_org(db: AsyncSession, org_id: UUID) -> dict[str, Any]:
    """Deny a pending org: set user.status=denied."""
    org = await db.get(Organization, org_id)
    if org is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)

    user = await db.get(User, org.user_id)
    if user is None or user.portal_role != PortalRole.ORG.value:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)

    _refuse_erased_org(user)
    if user.status != OrgUserStatus.PENDING_APPROVAL.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Organization is not in a pending-approval state.",
            status_code=400,
        )

    user.status = OrgUserStatus.DENIED.value
    bump_token_version(user)  # revoke outstanding sessions
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
    email_sent = await send_brand_invite_email(
        brand.company_email, token, brand_name=brand.brand_name
    )

    return {
        "brand_id": str(brand.id),
        "status": brand.status,
        "email_sent": email_sent,
    }


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
        bump_token_version(user)  # revoke outstanding sessions
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

    _refuse_erased_org(user)
    if user.status != OrgUserStatus.DENIED.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Organization is not denied.",
            status_code=400,
        )

    user.status = OrgUserStatus.PENDING_APPROVAL.value
    await db.flush()
    await send_org_undenied_email(user.edu_email or "", org_name=org.org_name)
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
    await send_brand_undenied_email(brand.company_email, brand_name=brand.brand_name)
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
    email_sent = await send_brand_invite_email(
        brand.company_email, token, brand_name=brand.brand_name
    )
    if not email_sent:
        raise BuzzAPIException(
            errors.EMAIL_SEND_FAILED,
            "We could not send the invite email. Please try again.",
            status_code=502,
        )
    return {
        "brand_id": str(brand.id),
        "status": brand.status,
        "email_sent": True,
    }


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

    _refuse_erased_org(user)
    clear_unusable_instagram_token(user)
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


_LOGISTICS_FIELDS = frozenset(
    {"capacity_total", "apply_open_at", "apply_close_at", "total_product_units"}
)
_CREATIVE_FIELDS = frozenset({"title", "description", "image", "location"})
_PRE_LIVE_STAGES = frozenset(
    {
        BrandTrackerStage.REQUEST_RECEIVED.value,
        BrandTrackerStage.FINALIZING_AGREEMENTS.value,
        BrandTrackerStage.AWAITING_PRODUCTS.value,
    }
)


def validate_https_image(url: str) -> str:
    """Require https hero URLs; reject placehold.co placeholders."""
    value = url.strip()
    if not value.startswith("https://"):
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "image must be an https:// URL.",
            status_code=400,
        )
    lower = value.lower()
    if "placehold.co" in lower or "://placehold.co" in lower:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "placeholder images are not allowed; use a real https image URL.",
            status_code=400,
        )
    return value


def _normalize_campaign_hashtag(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = raw.strip().lstrip("#").strip().lower()
    if not value:
        return None
    if len(value) > 255:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "campaign_hashtag must be at most 255 characters after normalization.",
            status_code=422,
        )
    return value


async def create_admin_drop(
    db: AsyncSession,
    brand_id: UUID,
    payload: AdminDropCreateRequest,
) -> Drop:
    """Create an unpublished draft drop; optionally promote a ticket."""

    brand = await db.get(Brand, brand_id)
    if brand is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Brand not found.", status_code=404)

    if payload.apply_open_at >= payload.apply_close_at:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "apply_open_at must be before apply_close_at.",
            status_code=400,
        )

    image = validate_https_image(payload.image)
    ticket: DropRequest | None = None
    if payload.drop_request_id is not None:
        ticket = await db.get(DropRequest, payload.drop_request_id)
        if ticket is None or ticket.brand_id != brand.id:
            raise BuzzAPIException(
                errors.NOT_FOUND,
                "Drop request not found for this brand.",
                status_code=404,
            )
        if ticket.status != "received":
            raise BuzzAPIException(
                errors.VALIDATION_ERROR,
                "Drop request is not in received status.",
                status_code=409,
            )

    drop = Drop(
        id=uuid4(),
        brand_id=brand.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        image=image,
        location=payload.location.strip(),
        capacity_total=payload.capacity_total,
        apply_open_at=payload.apply_open_at,
        apply_close_at=payload.apply_close_at,
        brand_tracker_stage=BrandTrackerStage.AWAITING_PRODUCTS.value,
        total_product_units=payload.total_product_units,
        campaign_hashtag=_normalize_campaign_hashtag(payload.campaign_hashtag),
        published_at=None,
        drop_request_id=ticket.id if ticket else None,
    )
    db.add(drop)
    await db.flush()

    if ticket is not None:
        ticket.status = "converted"
        ticket.converted_drop_id = drop.id
        touch_updated_at(ticket)
        await db.flush()
    return drop


async def publish_drop(db: AsyncSession, drop_id: UUID) -> Drop:
    """Set published_at, seed awaiting_products tracker, email the brand."""

    drop = await db.get(Drop, drop_id)
    if drop is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop not found.", status_code=404)
    if drop.published_at is not None:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Drop is already published.",
            status_code=409,
        )

    for field, label in (
        (drop.title, "title"),
        (drop.description, "description"),
        (drop.image, "image"),
        (drop.location, "location"),
    ):
        if not field or not str(field).strip():
            raise BuzzAPIException(
                errors.VALIDATION_ERROR,
                f"{label} is required before publish.",
                status_code=400,
            )
    validate_https_image(drop.image)

    now = datetime.now(timezone.utc)
    drop.published_at = now
    if drop.brand_tracker_stage == BrandTrackerStage.REQUEST_RECEIVED.value:
        drop.brand_tracker_stage = BrandTrackerStage.AWAITING_PRODUCTS.value
    db.add(
        DropTrackerEvent(
            drop_id=drop.id,
            stage=BrandTrackerStage.AWAITING_PRODUCTS.value,
            note="published",
        )
    )
    await db.flush()

    brand = await db.get(Brand, drop.brand_id)
    if brand is not None and brand.company_email:
        drop_url = f"{settings.FRONTEND_URL}/brand/drops/{drop.id}"
        await send_drop_published_email(
            brand.company_email,
            brand_name=brand.brand_name,
            drop_title=drop.title,
            drop_url=drop_url,
        )
    return drop


async def cleanup_request_received_stubs(
    db: AsyncSession, *, force: bool = False
) -> dict[str, Any]:
    """Convert unpublished request_received stubs into closed tickets and delete them.

    Idempotent. Production refuses unless ``force=True`` (script ``--confirm``).
    """

    if settings.ENVIRONMENT == "production" and not force:
        raise BuzzAPIException(
            errors.FORBIDDEN,
            "Refusing stub cleanup in production. Re-run with --confirm after explicit ops OK.",
            status_code=403,
        )

    stubs = list(
        await db.scalars(
            select(Drop).where(
                Drop.brand_tracker_stage == BrandTrackerStage.REQUEST_RECEIVED.value,
                Drop.published_at.is_(None),
            )
        )
    )
    deleted_ids: list[UUID] = []
    for drop in stubs:
        ticket = DropRequest(
            id=uuid4(),
            brand_id=drop.brand_id,
            message=drop.description or drop.title,
            notes=None,
            status="closed",
        )
        db.add(ticket)
        await db.flush()

        prior_tickets = list(
            await db.scalars(select(DropRequest).where(DropRequest.converted_drop_id == drop.id))
        )
        for prior in prior_tickets:
            prior.converted_drop_id = None
        drop.drop_request_id = None
        await db.flush()

        apps = list(
            await db.scalars(select(DropApplication).where(DropApplication.drop_id == drop.id))
        )
        for app in apps:
            await db.delete(app)
        notifies = list(await db.scalars(select(NotifyMe).where(NotifyMe.drop_id == drop.id)))
        for n in notifies:
            await db.delete(n)
        events = list(
            await db.scalars(select(DropTrackerEvent).where(DropTrackerEvent.drop_id == drop.id))
        )
        for evt in events:
            await db.delete(evt)

        deleted_ids.append(drop.id)
        logger.info(
            "cleanup_request_received: drop %s → closed ticket %s",
            drop.id,
            ticket.id,
        )
        await db.delete(drop)
        await db.flush()

    logger.info("cleanup_request_received: converted %s stubs", len(deleted_ids))
    return {"converted_count": len(deleted_ids), "deleted_drop_ids": deleted_ids}


async def update_drop_config(
    db: AsyncSession,
    drop_id: UUID,
    payload: AdminDropConfigPatch,
) -> None:
    """Apply admin logistics / draft creative patch fields."""

    drop = await db.get(Drop, drop_id)
    if drop is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop not found.", status_code=404)

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return

    creative_touched = bool(_CREATIVE_FIELDS & updates.keys())
    if creative_touched and drop.published_at is not None:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Title, description, image, and location cannot be changed after publish.",
            status_code=409,
        )

    logistics_touched = bool(_LOGISTICS_FIELDS & updates.keys())
    if logistics_touched and drop.brand_tracker_stage not in _PRE_LIVE_STAGES:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Capacity, apply window, and unit budget cannot be changed while "
            "the drop is live or finished.",
            status_code=409,
        )

    if "campaign_hashtag" in updates:
        updates["campaign_hashtag"] = _normalize_campaign_hashtag(updates["campaign_hashtag"])

    if "image" in updates:
        updates["image"] = validate_https_image(updates["image"])

    for key in ("title", "description", "location"):
        if key in updates and isinstance(updates[key], str):
            updates[key] = updates[key].strip()

    if "total_product_units" in updates and drop.applicant_selection_finalized_at is not None:
        current = drop.total_product_units
        new = updates["total_product_units"]
        if (current is None) != (new is None):
            raise BuzzAPIException(
                errors.VALIDATION_ERROR,
                "Cannot switch between spot-only and unit-allocated mode after "
                "applicant selection is finalized.",
                status_code=409,
            )

    merged_open = updates.get("apply_open_at", drop.apply_open_at)
    merged_close = updates.get("apply_close_at", drop.apply_close_at)
    if merged_open >= merged_close:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "apply_open_at must be before apply_close_at.",
            status_code=400,
        )

    if "capacity_total" in updates:
        accepted_count = int(
            await db.scalar(
                select(func.count())
                .select_from(DropApplication)
                .where(
                    DropApplication.drop_id == drop.id,
                    DropApplication.decision == ApplicationDecision.ACCEPTED.value,
                )
            )
            or 0
        )
        if updates["capacity_total"] < accepted_count:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR,
                f"capacity_total cannot be below accepted count ({accepted_count}).",
                status_code=400,
            )

    if "total_product_units" in updates and updates["total_product_units"] is not None:
        allocated = int(
            await db.scalar(
                select(func.coalesce(func.sum(DropApplication.allocated_units), 0)).where(
                    DropApplication.drop_id == drop.id,
                    DropApplication.decision == ApplicationDecision.ACCEPTED.value,
                )
            )
            or 0
        )
        if updates["total_product_units"] < allocated:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR,
                f"total_product_units cannot be below allocated units ({allocated}).",
                status_code=400,
            )

    for field, value in updates.items():
        setattr(drop, field, value)
    await db.flush()
