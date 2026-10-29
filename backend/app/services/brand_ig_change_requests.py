"""Brand Instagram handle change requests (PRODUCT §3.1.5).

Submit is a ticket. Approve writes ``brands.instagram_handle`` and nothing
else: no Graph ids, no token bump, no post moves. Existing links stay.
Later autolink scans use the new ``@``.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.brand import Brand
from app.models.brand_ig_change_request import BrandIgChangeRequest
from app.models.enums import BrandStatus, OrgUserStatus
from app.models.user import User
from app.services.instagram import canonical_instagram_handle
from app.services.org_apply import normalize_claimed_handle

logger = logging.getLogger(__name__)

_STATUSES = frozenset({"pending", "approved", "denied"})
_REASON_MIN = 10
_REASON_MAX = 4000


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize(row: BrandIgChangeRequest) -> dict[str, Any]:
    return {
        "id": row.id,
        "brand_id": row.brand_id,
        "user_id": row.user_id,
        "current_handle": row.current_handle,
        "requested_handle": row.requested_handle,
        "reason": row.reason,
        "status": row.status,
        "decided_at": row.decided_at,
        "created_at": row.created_at,
    }


def _pending_payload(row: BrandIgChangeRequest) -> dict[str, Any]:
    return {
        "id": row.id,
        "current_handle": row.current_handle,
        "requested_handle": row.requested_handle,
        "reason": row.reason,
        "created_at": row.created_at,
    }


def _stored_handle(raw: str | None) -> str:
    return canonical_instagram_handle(raw).lower()


async def brands_with_pending_ig_change(db: AsyncSession) -> set[UUID]:
    ids = await db.scalars(
        select(BrandIgChangeRequest.brand_id).where(BrandIgChangeRequest.status == "pending")
    )
    return set(ids.all())


async def pending_ig_change_for_brand(db: AsyncSession, brand_id: UUID) -> dict[str, Any] | None:
    row = await db.scalar(
        select(BrandIgChangeRequest).where(
            BrandIgChangeRequest.brand_id == brand_id,
            BrandIgChangeRequest.status == "pending",
        )
    )
    if row is None:
        return None
    return _pending_payload(row)


async def get_request_state(db: AsyncSession, brand: Brand) -> dict[str, Any]:
    pending = await db.scalar(
        select(BrandIgChangeRequest).where(
            BrandIgChangeRequest.brand_id == brand.id,
            BrandIgChangeRequest.status == "pending",
        )
    )
    latest = await db.scalar(
        select(BrandIgChangeRequest)
        .where(BrandIgChangeRequest.brand_id == brand.id)
        .order_by(BrandIgChangeRequest.created_at.desc())
        .limit(1)
    )
    return {
        "pending": _serialize(pending) if pending is not None else None,
        "latest": _serialize(latest) if latest is not None else None,
    }


async def submit_request(
    db: AsyncSession,
    brand: Brand,
    user: User,
    *,
    requested_handle: str,
    reason: str,
) -> dict[str, Any]:
    requested = normalize_claimed_handle(requested_handle).lower()
    current = _stored_handle(brand.instagram_handle)
    if current and requested == current:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Requested handle must be different from the current handle.",
            status_code=400,
        )
    cleaned_reason = reason.strip()
    if len(cleaned_reason) < _REASON_MIN:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            f"Explain the change in at least {_REASON_MIN} characters.",
            status_code=400,
        )
    if len(cleaned_reason) > _REASON_MAX:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            f"Reason must be at most {_REASON_MAX} characters.",
            status_code=400,
        )

    existing_pending = await db.scalar(
        select(BrandIgChangeRequest.id).where(
            BrandIgChangeRequest.brand_id == brand.id,
            BrandIgChangeRequest.status == "pending",
        )
    )
    if existing_pending is not None:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "This brand already has a pending Instagram handle request.",
            status_code=409,
        )

    row = BrandIgChangeRequest(
        id=uuid4(),
        brand_id=brand.id,
        user_id=user.id,
        current_handle=current,
        requested_handle=requested,
        reason=cleaned_reason,
        status="pending",
    )
    try:
        async with db.begin_nested():
            db.add(row)
            await db.flush()
    except IntegrityError as exc:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "This brand already has a pending Instagram handle request.",
            status_code=409,
        ) from exc
    logger.info(
        "brand_ig_change_request_submitted request_id=%s brand_id=%s",
        row.id,
        brand.id,
    )
    return _serialize(row)


async def list_requests(db: AsyncSession, *, status: str | None = None) -> list[dict[str, Any]]:
    if status is not None and status not in _STATUSES:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            f"Unknown request status: {status}.",
            status_code=400,
        )
    stmt = (
        select(BrandIgChangeRequest, Brand)
        .join(Brand, Brand.id == BrandIgChangeRequest.brand_id)
        .order_by(BrandIgChangeRequest.created_at.asc())
    )
    if status is not None:
        stmt = stmt.where(BrandIgChangeRequest.status == status)
    rows = list(await db.execute(stmt))
    return [
        {
            **_serialize(req),
            "brand_name": brand.brand_name,
            "company_email": brand.company_email,
        }
        for req, brand in rows
    ]


async def _load_pending(
    db: AsyncSession, request_id: UUID
) -> tuple[BrandIgChangeRequest, Brand, User]:
    row = (
        await db.execute(
            select(BrandIgChangeRequest, Brand, User)
            .join(Brand, Brand.id == BrandIgChangeRequest.brand_id)
            .join(User, User.id == BrandIgChangeRequest.user_id)
            .where(BrandIgChangeRequest.id == request_id)
        )
    ).first()
    if row is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Request not found.", status_code=404)
    req, brand, user = row
    if req.status != "pending":
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "This request has already been decided.",
            status_code=400,
        )
    if brand.status == BrandStatus.ERASED.value or user.status == OrgUserStatus.ERASED.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Brand account has been erased.",
            status_code=409,
        )
    return req, brand, user


async def approve_request(db: AsyncSession, request_id: UUID) -> dict[str, Any]:
    req, brand, _user = await _load_pending(db, request_id)
    req.status = "approved"
    req.decided_at = _now()
    brand.instagram_handle = req.requested_handle
    await db.flush()
    logger.info(
        "brand_ig_change_request_approved request_id=%s brand_id=%s",
        req.id,
        brand.id,
    )
    return {
        **_serialize(req),
        "brand_name": brand.brand_name,
        "company_email": brand.company_email,
    }


async def deny_request(db: AsyncSession, request_id: UUID) -> dict[str, Any]:
    req, brand, _user = await _load_pending(db, request_id)
    req.status = "denied"
    req.decided_at = _now()
    await db.flush()
    logger.info(
        "brand_ig_change_request_denied request_id=%s brand_id=%s",
        req.id,
        brand.id,
    )
    return {
        **_serialize(req),
        "brand_name": brand.brand_name,
        "company_email": brand.company_email,
    }
