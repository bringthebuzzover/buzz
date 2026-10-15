"""Creator-only drops. Not the org publish or org feed path."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
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
    CreatorStatus,
)
from app.models.user import User
from app.services.creators import creator_for_user


def buzz_fee_for(creator_gross: int) -> int:
    """20% of creator gross, charged on top. 300 → 60."""
    return creator_gross * 20 // 100


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


async def publish_creator_drop(
    db: AsyncSession,
    *,
    brand_id: uuid.UUID,
    title: str,
    description: str,
    creator_cap: int,
    creator_gross: int,
    apply_open_at: datetime,
    apply_close_at: datetime,
    image: str | None = None,
) -> Drop:
    """Publish a digital creator drop. Does not email the org drop notice."""
    brand = await db.get(Brand, brand_id)
    if brand is None or brand.status != BrandStatus.APPROVED.value:
        raise BuzzAPIException(errors.NOT_FOUND, "Brand not found.", status_code=404)
    if apply_open_at >= apply_close_at:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "The apply window must end after it starts.",
            status_code=400,
        )
    if creator_cap < 1 or creator_gross < 0:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Creator cap and gross must be valid.",
            status_code=400,
        )
    drop = Drop(
        id=uuid.uuid4(),
        brand_id=brand.id,
        title=title,
        description=description,
        image=image,
        location="Digital",
        capacity_total=creator_cap,
        apply_open_at=apply_open_at,
        apply_close_at=apply_close_at,
        brand_tracker_stage=BrandTrackerStage.REQUEST_RECEIVED.value,
        audience="creators",
        creator_cap=creator_cap,
        creator_gross=creator_gross,
        published_at=_now(),
    )
    db.add(drop)
    await db.flush()
    return drop


async def _accepted_count(db: AsyncSession, drop_id: uuid.UUID) -> int:
    count = await db.scalar(
        select(func.count())
        .select_from(DropApplication)
        .where(
            DropApplication.drop_id == drop_id,
            DropApplication.decision == ApplicationDecision.ACCEPTED.value,
        )
    )
    return int(count or 0)


def drop_card(drop: Drop, brand_name: str, accepted: int) -> dict:
    now = _now()
    open_at = _aware(drop.apply_open_at)
    close_at = _aware(drop.apply_close_at)
    window_open = now < close_at
    cap = drop.creator_cap or 0
    if now < open_at:
        status = "upcoming"
    elif window_open and accepted < cap:
        status = "open"
    else:
        status = "closed"
    gross = drop.creator_gross or 0
    fee = buzz_fee_for(gross)
    return {
        "id": str(drop.id),
        "title": drop.title,
        "brand_name": brand_name,
        "description": drop.description,
        "image_url": drop.image,
        "status": status,
        "window_open": window_open,
        "creator_cap": cap,
        "accepted_count": accepted,
        "creator_gross": gross,
        "buzz_fee": fee,
        "brand_total": gross + fee,
    }


async def list_creator_feed(db: AsyncSession, user: User) -> list[dict]:
    creator = await creator_for_user(db, user)
    if creator.status != CreatorStatus.ACTIVE.value:
        raise BuzzAPIException(
            errors.FORBIDDEN,
            "Your creator account cannot open the feed.",
            status_code=403,
        )
    rows = (
        await db.execute(
            select(Drop, Brand.brand_name)
            .join(Brand, Brand.id == Drop.brand_id)
            .where(
                Drop.audience == "creators",
                Drop.published_at.isnot(None),
                Drop.hidden_at.is_(None),
                Brand.status == BrandStatus.APPROVED.value,
            )
        )
    ).all()
    cards = []
    for drop, brand_name in rows:
        cards.append(drop_card(drop, brand_name, await _accepted_count(db, drop.id)))
    return cards


async def apply_to_creator_drop(
    db: AsyncSession, user: User, drop_id: uuid.UUID, pitch: str
) -> dict:
    creator = await creator_for_user(db, user)
    if creator.status != CreatorStatus.ACTIVE.value:
        raise BuzzAPIException(
            errors.FORBIDDEN,
            "Your creator account cannot apply yet.",
            status_code=403,
        )
    drop = await db.get(Drop, drop_id)
    if drop is None or drop.audience != "creators" or drop.published_at is None:
        raise BuzzAPIException(errors.DROP_NOT_OPEN, "This drop is not available.", status_code=400)
    brand = await db.get(Brand, drop.brand_id)
    accepted = await _accepted_count(db, drop.id)
    card = drop_card(drop, brand.brand_name if brand else "", accepted)
    if card["status"] != "open":
        raise BuzzAPIException(errors.DROP_NOT_OPEN, "This drop is not open.", status_code=400)
    existing = await db.scalar(
        select(DropApplication.id).where(
            DropApplication.drop_id == drop.id,
            DropApplication.creator_id == creator.id,
            DropApplication.decision != ApplicationDecision.DENIED.value,
        )
    )
    if existing is not None:
        raise BuzzAPIException(
            errors.ALREADY_APPLIED,
            "You already applied to this drop.",
            status_code=409,
        )
    cleaned = pitch.strip()
    if not cleaned:
        raise BuzzAPIException(errors.VALIDATION_ERROR, "A pitch is required.", status_code=400)
    row = DropApplication(
        id=uuid.uuid4(),
        drop_id=drop.id,
        org_id=None,
        creator_id=creator.id,
        decision=ApplicationDecision.APPLIED.value,
        pitch=cleaned,
    )
    db.add(row)
    await db.flush()
    return {"application_id": str(row.id), "decision": row.decision}
