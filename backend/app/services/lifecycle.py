"""Drop lifecycle: the computed stage and the seat rules every surface shares.

Single source of truth for "where is this drop?" The stage is never stored;
it is computed in SQL from four facts so a screen can never disagree with
the dates or the seats:

* ``published_at`` — null means **draft**;
* ``wrapped_at`` — set means **wrapped** (BUZZ click);
* the apply window — before it **upcoming**, inside it **applying**;
* after the window, **live** once any accepted decision went out, else
  **selecting**.

Hidden is a separate flag (``drops.hidden_at``) on top of any stage.

Seats move on their own. A drop stage never blocks a seat except hidden
(and later canceled). Wrapped only ends org self-service linking after
``ORG_LINK_GRACE``; BUZZ (View as) can always link, and can always late-add.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta

from sqlalchemy import and_, case, exists, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.enums import ApplicationDecision, DropStage
from app.timeutils import as_utc, utcnow

# Orgs may link and unlink their own posts this long after wrap-up (D-4).
ORG_LINK_GRACE = timedelta(days=30)
# Metrics keep syncing this long after wrap-up, then freeze (D-5).
METRIC_SYNC_AFTER_WRAP = timedelta(days=60)


def seat_is_live() -> ColumnElement[bool]:
    """An accepted seat whose decision went out (the org knows it is in)."""

    return and_(
        DropApplication.decision == ApplicationDecision.ACCEPTED.value,
        DropApplication.decision_sent_at.is_not(None),
    )


def seat_is_denied_and_sent() -> ColumnElement[bool]:
    """A denial the org has been told about (invisible to the org afterwards)."""

    return and_(
        DropApplication.decision == ApplicationDecision.DENIED.value,
        DropApplication.decision_sent_at.is_not(None),
    )


def drop_stage_expr(now: datetime) -> ColumnElement[str]:
    """SQL ``CASE`` computing ``DropStage`` for the ``drops`` row in scope."""

    has_live_seat = exists(
        select(DropApplication.id).where(DropApplication.drop_id == Drop.id, seat_is_live())
    )
    return case(
        (Drop.published_at.is_(None), DropStage.DRAFT.value),
        (Drop.wrapped_at.is_not(None), DropStage.WRAPPED.value),
        (Drop.apply_open_at > now, DropStage.UPCOMING.value),
        (Drop.apply_close_at >= now, DropStage.APPLYING.value),
        (has_live_seat, DropStage.LIVE.value),
        else_=DropStage.SELECTING.value,
    )


async def drop_stages(
    db: AsyncSession, drop_ids: Sequence[uuid.UUID], *, now: datetime | None = None
) -> dict[uuid.UUID, DropStage]:
    """Map drop id → computed stage, in one query."""

    if not drop_ids:
        return {}
    rows = await db.execute(
        select(Drop.id, drop_stage_expr(now or utcnow())).where(Drop.id.in_(list(drop_ids)))
    )
    return {drop_id: DropStage(stage) for drop_id, stage in rows.all()}


async def drop_stage(db: AsyncSession, drop: Drop, *, now: datetime | None = None) -> DropStage:
    """Computed stage for one drop (flushes pending changes first)."""

    await db.flush()
    return (await drop_stages(db, [drop.id], now=now))[drop.id]


def apply_window_closed(drop: Drop, now: datetime) -> bool:
    """Applications closed: the close date has passed."""

    return now > as_utc(drop.apply_close_at)


def org_link_open(drop: Drop, now: datetime) -> bool:
    """Whether the org itself may link/unlink posts (BUZZ View as always may)."""

    if drop.hidden_at is not None:
        return False
    if drop.wrapped_at is None:
        return True
    return now < as_utc(drop.wrapped_at) + ORG_LINK_GRACE


def _open_until_after_wrap(window: timedelta) -> ColumnElement[bool]:
    cutoff = utcnow() - window
    return and_(
        Drop.published_at.is_not(None),
        Drop.hidden_at.is_(None),
        (Drop.wrapped_at.is_(None)) | (Drop.wrapped_at > cutoff),
    )


def metrics_sync_open() -> ColumnElement[bool]:
    """Drops whose linked posts still sync metrics (D-5)."""

    return _open_until_after_wrap(METRIC_SYNC_AFTER_WRAP)


def autolink_open() -> ColumnElement[bool]:
    """Drops that still mint autolink suggestions (same window as org linking)."""

    return _open_until_after_wrap(ORG_LINK_GRACE)


def org_visible_decision(application: DropApplication) -> str:
    """What the org sees: an unsent decision still reads ``applied``."""

    if application.decision_sent_at is None:
        return ApplicationDecision.APPLIED.value
    return application.decision
