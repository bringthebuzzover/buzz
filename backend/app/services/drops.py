"""Drop feed orchestration (architecture.md §5.1 ``GET /api/drops``, §7.1).

Pure service functions (no FastAPI types) the route layer calls. The org feed
returns a page of drops enriched with two server-computed fields:

* ``accepted_count`` — number of ``accepted`` applications on the drop.
* ``already_applied`` — whether the *calling* org has a non-denied application.

Both are computed with set/grouped queries keyed by the page's drop ids, so the
feed is two extra queries regardless of page size (no N+1). ``Drop.brand_name``
is denormalized, so no brand join is needed.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.enums import ApplicationDecision
from app.models.organization import Organization
from app.models.user import User
from app.schemas.drops import DropFeedItem


async def list_org_drop_feed(
    db: AsyncSession,
    org_user: User,
    *,
    page: int,
    per_page: int,
) -> tuple[list[DropFeedItem], int]:
    """Return one page of the org drop feed plus the total drop count.

    An ``active`` org normally has an ``organizations`` row; a user without one
    (e.g. mid-onboarding) simply gets ``already_applied = False`` everywhere
    rather than an error.
    """

    org_id = await db.scalar(select(Organization.id).where(Organization.user_id == org_user.id))

    total = await db.scalar(select(func.count()).select_from(Drop)) or 0

    # ``id`` is the tiebreaker: ``created_at`` defaults to the transaction clock,
    # so rows seeded in one transaction share a timestamp — ordering on it alone
    # is not stable and LIMIT/OFFSET could skip or duplicate rows across pages.
    drops = list(
        await db.scalars(
            select(Drop)
            .order_by(Drop.created_at.desc(), Drop.id.desc())
            .limit(per_page)
            .offset((page - 1) * per_page)
        )
    )

    page_ids = [drop.id for drop in drops]
    accepted_counts = await _accepted_counts(db, page_ids)
    applied_ids = await _applied_drop_ids(db, org_id, page_ids)

    items = [
        DropFeedItem(
            id=drop.id,
            brand_name=drop.brand_name,
            title=drop.title,
            description=drop.description,
            image=drop.image,
            location=drop.location,
            capacity_total=drop.capacity_total,
            apply_open_at=drop.apply_open_at,
            apply_close_at=drop.apply_close_at,
            manual_reopen=drop.manual_reopen,
            accepted_count=accepted_counts.get(drop.id, 0),
            already_applied=drop.id in applied_ids,
        )
        for drop in drops
    ]
    return items, total


async def _accepted_counts(db: AsyncSession, drop_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """Map drop_id -> count of ``accepted`` applications for the page's drops."""

    if not drop_ids:
        return {}
    rows = await db.execute(
        select(DropApplication.drop_id, func.count())
        .where(
            DropApplication.decision == ApplicationDecision.ACCEPTED.value,
            DropApplication.drop_id.in_(drop_ids),
        )
        .group_by(DropApplication.drop_id)
    )
    return {drop_id: count for drop_id, count in rows.all()}


async def _applied_drop_ids(
    db: AsyncSession,
    org_id: uuid.UUID | None,
    drop_ids: list[uuid.UUID],
) -> set[uuid.UUID]:
    """Drop ids the calling org has a non-denied application on (the page's set)."""

    if org_id is None or not drop_ids:
        return set()
    rows = await db.scalars(
        select(DropApplication.drop_id).where(
            DropApplication.org_id == org_id,
            DropApplication.decision != ApplicationDecision.DENIED.value,
            DropApplication.drop_id.in_(drop_ids),
        )
    )
    return set(rows.all())
