"""Brand drop-request intake (buzz-ops product/PRODUCT.md §5.2).

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
from app.models.drop import Drop
from app.models.drop_request import DropRequest
from app.schemas.drops import BrandDropRequestCreate, BrandDropRequestResponse


def build_drop_request_response(
    ticket: DropRequest, *, converted_drop_id: uuid.UUID | None
) -> BrandDropRequestResponse:
    return BrandDropRequestResponse(
        id=ticket.id,
        brand_id=ticket.brand_id,
        message=ticket.message,
        product=ticket.product,
        title=ticket.title,
        location=ticket.location,
        target_date=ticket.target_date,
        org_count=ticket.org_count,
        units_per_org=ticket.units_per_org,
        campaign_hashtag=ticket.campaign_hashtag,
        notes=ticket.notes,
        status=ticket.status,
        converted_drop_id=converted_drop_id,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


async def _brand_converted_drop_id(db: AsyncSession, ticket: DropRequest) -> uuid.UUID | None:
    if ticket.converted_drop_id is None:
        return None
    drop = await db.get(Drop, ticket.converted_drop_id)
    if drop is None or drop.hidden_at is not None:
        return None
    return ticket.converted_drop_id


async def brand_drop_request_response(
    db: AsyncSession, ticket: DropRequest
) -> BrandDropRequestResponse:
    return build_drop_request_response(
        ticket, converted_drop_id=await _brand_converted_drop_id(db, ticket)
    )


async def create_brand_drop_request(
    db: AsyncSession,
    brand: Brand,
    payload: BrandDropRequestCreate,
) -> DropRequest:
    """Insert a received ticket for *brand*.

    ``payload`` is already validated (required message/product, bounds, hashtag).
    """

    ticket = DropRequest(
        id=uuid.uuid4(),
        brand_id=brand.id,
        message=payload.message,
        product=payload.product,
        title=payload.title,
        location=payload.location,
        target_date=payload.target_date,
        org_count=payload.org_count,
        units_per_org=payload.units_per_org,
        campaign_hashtag=payload.campaign_hashtag,
        notes=payload.notes,
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
