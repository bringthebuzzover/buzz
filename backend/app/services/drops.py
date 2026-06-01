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
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.enums import ApplicationDecision
from app.models.notify_me import NotifyMe
from app.models.organization import Organization
from app.models.user import User
from app.schemas.drops import ApplicationResponse, DropDetailResponse, DropFeedItem


def _as_utc(value: datetime) -> datetime:
    """Coerce a (possibly naive) datetime to UTC for safe comparison."""

    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


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


# --- Drop detail + apply + notify (Stage 5A) ---------------------------------


async def get_drop_or_404(db: AsyncSession, drop_id: uuid.UUID) -> Drop:
    """Load a drop or raise ``NOT_FOUND`` (404)."""

    drop = await db.get(Drop, drop_id)
    if drop is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop not found.", status_code=404)
    return drop


async def _require_org(db: AsyncSession, org_user: User) -> Organization:
    """Resolve the caller's org profile.

    ``CurrentOrg`` already guarantees role=org + active, so an active org with
    no ``organizations`` row is an invariant violation, not a user error → 500
    (avoids an ambiguous 404 alongside "drop not found" on apply/notify).

    NOTE: ``GET /api/orgs/me`` deliberately returns 404 for the same condition
    (it's a profile-read, where "not found" is meaningful), and
    ``build_drop_detail`` tolerates a missing profile (``already_applied=False``).
    The divergence is intentional, per the Stage 5A plan's review-S9 decision.
    """

    org = await db.scalar(select(Organization).where(Organization.user_id == org_user.id))
    if org is None:
        raise BuzzAPIException(
            errors.INTERNAL_ERROR,
            "Active org account is missing its profile.",
            status_code=500,
        )
    return org


async def build_drop_detail(
    db: AsyncSession,
    org_user: User,
    drop: Drop,
) -> DropDetailResponse:
    """Serialize a single drop for the org detail view (with derived fields)."""

    org_id = await db.scalar(select(Organization.id).where(Organization.user_id == org_user.id))
    accepted = (await _accepted_counts(db, [drop.id])).get(drop.id, 0)
    applied_ids = await _applied_drop_ids(db, org_id, [drop.id])
    return DropDetailResponse(
        id=drop.id,
        brand_id=drop.brand_id,
        brand_name=drop.brand_name,
        title=drop.title,
        description=drop.description,
        image=drop.image,
        location=drop.location,
        capacity_total=drop.capacity_total,
        apply_open_at=drop.apply_open_at,
        apply_close_at=drop.apply_close_at,
        manual_reopen=drop.manual_reopen,
        total_product_units=drop.total_product_units,
        created_at=drop.created_at,
        accepted_count=accepted,
        already_applied=drop.id in applied_ids,
    )


async def apply_to_drop(
    db: AsyncSession,
    org_user: User,
    drop_id: uuid.UUID,
    pitch: str | None,
) -> DropApplication:
    """Create an ``applied`` application, enforcing the §7.1/§11.3 rules.

    Order: drop exists → apply window open (mirrors ``getDropFeedStatus``) →
    not already applied (a prior ``denied`` does NOT block) → capacity remains.
    """

    org = await _require_org(db, org_user)
    drop = await get_drop_or_404(db, drop_id)

    now = datetime.now(timezone.utc)
    if now < _as_utc(drop.apply_open_at):
        raise BuzzAPIException(errors.DROP_NOT_OPEN, "This drop is not open for applications yet.")
    if now > _as_utc(drop.apply_close_at) and not drop.manual_reopen:
        raise BuzzAPIException(errors.DROP_NOT_OPEN, "This drop is closed for applications.")

    existing = await db.scalar(
        select(DropApplication.id).where(
            DropApplication.org_id == org.id,
            DropApplication.drop_id == drop.id,
            DropApplication.decision != ApplicationDecision.DENIED.value,
        )
    )
    if existing is not None:
        raise BuzzAPIException(errors.ALREADY_APPLIED, "You have already applied to this drop.")

    accepted = (await _accepted_counts(db, [drop.id])).get(drop.id, 0)
    if accepted >= drop.capacity_total:
        raise BuzzAPIException(errors.CAPACITY_EXCEEDED, "This drop has no remaining spots.")

    pitch_clean = pitch.strip() if pitch and pitch.strip() else None
    application = DropApplication(
        id=uuid.uuid4(),
        drop_id=drop.id,
        org_id=org.id,
        decision=ApplicationDecision.APPLIED.value,
        pitch=pitch_clean,
    )
    db.add(application)
    await db.flush()
    return application


def build_application_response(application: DropApplication) -> ApplicationResponse:
    """Serialize a ``DropApplication`` ORM row into the wire schema."""

    return ApplicationResponse.model_validate(application, from_attributes=True)


async def set_notify(
    db: AsyncSession,
    org_user: User,
    drop_id: uuid.UUID,
    reminder_minutes: int,
) -> NotifyMe:
    """Upsert the caller org's reminder for a drop (one row per org+drop)."""

    org = await _require_org(db, org_user)
    await get_drop_or_404(db, drop_id)
    notify = await db.scalar(
        select(NotifyMe).where(NotifyMe.org_id == org.id, NotifyMe.drop_id == drop_id)
    )
    if notify is None:
        notify = NotifyMe(
            id=uuid.uuid4(),
            org_id=org.id,
            drop_id=drop_id,
            reminder_minutes=reminder_minutes,
            enabled=True,
        )
        db.add(notify)
    else:
        notify.reminder_minutes = reminder_minutes
        notify.enabled = True
    await db.flush()
    return notify


async def clear_notify(db: AsyncSession, org_user: User, drop_id: uuid.UUID) -> None:
    """Remove the caller org's reminder for a drop (idempotent)."""

    org = await _require_org(db, org_user)
    await get_drop_or_404(db, drop_id)
    notify = await db.scalar(
        select(NotifyMe).where(NotifyMe.org_id == org.id, NotifyMe.drop_id == drop_id)
    )
    if notify is not None:
        await db.delete(notify)
        await db.flush()
