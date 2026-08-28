"""Brand drop-request intake (LAUNCH.md Phase B / PRODUCT §5.2).

Plan your Campaign creates a ``drop_requests`` ticket only — never a ``drops``
row. Admins convert tickets into unpublished drafts, then Publish.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.brand import Brand
from app.models.drop_request import DropRequest
from app.schemas.drops import BrandDropRequestResponse


def build_drop_request_response(ticket: DropRequest) -> BrandDropRequestResponse:
    return BrandDropRequestResponse(
        id=ticket.id,
        brand_id=ticket.brand_id,
        message=ticket.message,
        notes=ticket.notes,
        status=ticket.status,
        converted_drop_id=ticket.converted_drop_id,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


async def create_brand_drop_request(
    db: AsyncSession,
    brand: Brand,
    *,
    message: str,
    notes: str | None = None,
) -> DropRequest:
    """Insert a received ticket for *brand*."""

    msg = message.strip()
    if not msg:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "message is required.",
            status_code=400,
        )
    note = notes.strip() if notes and notes.strip() else None
    ticket = DropRequest(
        id=uuid.uuid4(),
        brand_id=brand.id,
        message=msg,
        notes=note,
        status="received",
    )
    db.add(ticket)
    await db.flush()
    return ticket


async def list_brand_drop_requests(db: AsyncSession, brand: Brand) -> list[DropRequest]:
    return list(
        await db.scalars(
            select(DropRequest)
            .where(DropRequest.brand_id == brand.id)
            .order_by(DropRequest.created_at.desc())
        )
    )


async def get_brand_drop_request(
    db: AsyncSession,
    brand: Brand,
    request_id: uuid.UUID,
) -> DropRequest:
    ticket = await db.get(DropRequest, request_id)
    if ticket is None or ticket.brand_id != brand.id:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop request not found.", status_code=404)
    return ticket


async def list_admin_drop_requests(
    db: AsyncSession,
    *,
    status: str | None = None,
    brand_id: uuid.UUID | None = None,
) -> list[tuple[DropRequest, Brand]]:
    stmt = (
        select(DropRequest, Brand)
        .join(Brand, Brand.id == DropRequest.brand_id)
        .order_by(DropRequest.created_at.desc())
    )
    if status:
        stmt = stmt.where(DropRequest.status == status)
    if brand_id is not None:
        stmt = stmt.where(DropRequest.brand_id == brand_id)
    rows = (await db.execute(stmt)).all()
    return [(ticket, brand) for ticket, brand in rows]


async def get_admin_drop_request(
    db: AsyncSession, request_id: uuid.UUID
) -> tuple[DropRequest, Brand]:
    row = (
        await db.execute(
            select(DropRequest, Brand)
            .join(Brand, Brand.id == DropRequest.brand_id)
            .where(DropRequest.id == request_id)
        )
    ).first()
    if row is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop request not found.", status_code=404)
    return row[0], row[1]


def touch_updated_at(ticket: DropRequest) -> None:
    ticket.updated_at = datetime.now(timezone.utc)
