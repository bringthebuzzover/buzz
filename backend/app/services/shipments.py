"""Per-application shipment numbers (PRODUCT §3.1.1)."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote
from uuid import UUID

from sqlalchemy import exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import ColumnElement

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.enums import ApplicationDecision, BrandTrackerStage
from app.models.shipment import CARRIERS, DropApplicationShipment

_UPS_TRACK = "https://www.ups.com/track?tracknum="
_FEDEX_TRACK = "https://www.fedex.com/fedextrack/?trknbr="


def infer_carrier(tracking_number: str) -> str:
    raw = tracking_number.strip()
    if raw.upper().startswith("1Z"):
        return "ups"
    compact = "".join(ch for ch in raw if not ch.isspace())
    if compact.isdigit() and 12 <= len(compact) <= 22:
        return "fedex"
    return "unknown"


def track_url(carrier: str, tracking_number: str) -> str | None:
    encoded = quote(tracking_number.strip(), safe="")
    if carrier == "ups":
        return f"{_UPS_TRACK}{encoded}"
    if carrier == "fedex":
        return f"{_FEDEX_TRACK}{encoded}"
    return None


def serialize_shipment(row: DropApplicationShipment) -> dict[str, Any]:
    return {
        "id": row.id,
        "tracking_number": row.tracking_number,
        "carrier": row.carrier,
        "track_url": track_url(row.carrier, row.tracking_number),
    }


async def shipments_by_application_ids(
    db: AsyncSession, application_ids: list[UUID]
) -> dict[UUID, list[dict[str, Any]]]:
    out: dict[UUID, list[dict[str, Any]]] = {i: [] for i in application_ids}
    if not application_ids:
        return out
    rows = (
        await db.scalars(
            select(DropApplicationShipment)
            .where(DropApplicationShipment.application_id.in_(application_ids))
            .order_by(
                DropApplicationShipment.created_at.asc(),
                DropApplicationShipment.id.asc(),
            )
        )
    ).all()
    for row in rows:
        out[row.application_id].append(serialize_shipment(row))
    return out


def awaiting_products_no_tracking_clause() -> tuple[ColumnElement[bool], ...]:
    """Attention / KPI: awaiting products, and a seat is unshipped (or none)."""
    accepted = ApplicationDecision.ACCEPTED.value
    has_unshipped = exists(
        select(1)
        .select_from(DropApplication)
        .where(
            DropApplication.drop_id == Drop.id,
            DropApplication.decision == accepted,
            ~exists(
                select(1)
                .select_from(DropApplicationShipment)
                .where(DropApplicationShipment.application_id == DropApplication.id)
            ),
        )
    )
    no_accepted = ~exists(
        select(1)
        .select_from(DropApplication)
        .where(
            DropApplication.drop_id == Drop.id,
            DropApplication.decision == accepted,
        )
    )
    return (
        Drop.brand_tracker_stage == BrandTrackerStage.AWAITING_PRODUCTS.value,
        or_(no_accepted, has_unshipped),
    )


async def add_shipment(
    db: AsyncSession,
    application_id: UUID,
    tracking_number: str,
    carrier: str | None,
) -> dict[str, Any]:
    application = await db.get(DropApplication, application_id)
    if application is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Application not found.", status_code=404)
    if application.decision != ApplicationDecision.ACCEPTED.value:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Tracking can only be added on an accepted organization.",
            status_code=400,
        )

    cleaned = tracking_number.strip()
    if not cleaned:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Tracking number is required.",
            status_code=400,
        )

    inferred = infer_carrier(cleaned)
    picked = (carrier or "").strip().lower()
    if picked:
        if picked not in CARRIERS:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR,
                "Carrier must be ups, fedex, or unknown.",
                status_code=400,
            )
        resolved = picked
    elif inferred == "unknown":
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Could not infer carrier. Pick UPS, FedEx, or unknown.",
            status_code=400,
        )
    else:
        resolved = inferred

    existing = await db.scalar(
        select(DropApplicationShipment.id).where(
            DropApplicationShipment.application_id == application_id,
            DropApplicationShipment.tracking_number == cleaned,
        )
    )
    if existing is not None:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "That tracking number is already on this organization.",
            status_code=409,
        )

    row = DropApplicationShipment(
        application_id=application_id,
        tracking_number=cleaned,
        carrier=resolved,
    )
    db.add(row)
    await db.flush()
    return serialize_shipment(row)


async def delete_shipment(
    db: AsyncSession, application_id: UUID, shipment_id: UUID
) -> dict[str, Any]:
    application = await db.get(DropApplication, application_id)
    if application is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Application not found.", status_code=404)
    row = await db.get(DropApplicationShipment, shipment_id)
    if row is None or row.application_id != application_id:
        raise BuzzAPIException(errors.NOT_FOUND, "Shipment not found.", status_code=404)
    await db.delete(row)
    await db.flush()
    return {"ok": True, "id": str(shipment_id)}
