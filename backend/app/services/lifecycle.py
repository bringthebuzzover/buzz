"""Drop lifecycle: the computed stage and the seat rules every surface shares.

Single source of truth for "where is this drop?" The stage is never stored;
it is computed in SQL from a few facts so a screen can never disagree with
the dates or the seats:

* ``published_at`` — null means **draft**;
* ``canceled_at`` — set means **canceled** (BUZZ click, final);
* ``wrapped_at`` — set means **wrapped** (BUZZ click);
* the apply window — before it **upcoming**, inside it **applying**;
* after the window, **live** once any accepted decision went out, else
  **selecting**.

Hidden is a separate flag (``drops.hidden_at``) on top of any stage.

Seats move on their own. A drop stage never blocks a seat except hidden
and canceled. Wrapped only ends org self-service linking after
``ORG_LINK_GRACE``; BUZZ (View as) can always link, and can always late-add.
A canceled drop takes no new seats, decisions, shipments or links; what
exists stays for the brand report.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta

from sqlalchemy import and_, case, exists, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.enums import ApplicationDecision, DropStage, SeatProgress
from app.models.post_link import PostCampaignLink
from app.models.shipment import DropApplicationShipment
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


# A seat ends by withdrawal or removal: final at once, never a draft.
ENDED_DECISIONS = frozenset({ApplicationDecision.WITHDREW.value, ApplicationDecision.REMOVED.value})

# Seats the org no longer sees once sent: a denial or an ended seat.
ORG_HIDDEN_DECISIONS = ENDED_DECISIONS | {ApplicationDecision.DENIED.value}


def seat_hidden_from_org() -> ColumnElement[bool]:
    """Ended seats the org was told about; gone from its campaigns."""

    return and_(
        DropApplication.decision.in_(ORG_HIDDEN_DECISIONS),
        DropApplication.decision_sent_at.is_not(None),
    )


def seat_frees_reapply() -> ColumnElement[bool]:
    """Seats that let the org apply again (a sent denial or a withdrawal).

    A removed seat keeps the org off the drop.
    """

    return and_(
        DropApplication.decision.in_(
            (ApplicationDecision.DENIED.value, ApplicationDecision.WITHDREW.value)
        ),
        DropApplication.decision_sent_at.is_not(None),
    )


def seat_in_report() -> ColumnElement[bool]:
    """Seats whose posts count for the brand: accepted, or ended after it (D-8)."""

    return DropApplication.decision.in_(
        (
            ApplicationDecision.ACCEPTED.value,
            ApplicationDecision.WITHDREW.value,
            ApplicationDecision.REMOVED.value,
        )
    )


async def seat_progress(
    db: AsyncSession, applications: Sequence[DropApplication]
) -> dict[uuid.UUID, SeatProgress | None]:
    """Per-seat progress (plan §3.3): Accepted → Shipped → Delivered → Posted.

    The furthest fact reached wins, so a post before the package is marked
    delivered still reads Posted. ``None`` for seats that are not live.
    """

    ids = [application.id for application in applications]
    if not ids:
        return {}
    shipped = set(
        await db.scalars(
            select(DropApplicationShipment.application_id)
            .where(DropApplicationShipment.application_id.in_(ids))
            .distinct()
        )
    )
    posted = set(
        await db.scalars(
            select(PostCampaignLink.application_id)
            .where(PostCampaignLink.application_id.in_(ids))
            .distinct()
        )
    )

    def one(application: DropApplication) -> SeatProgress | None:
        if (
            application.decision != ApplicationDecision.ACCEPTED.value
            or application.decision_sent_at is None
        ):
            return None
        if application.id in posted:
            return SeatProgress.POSTED
        if application.delivered_at is not None:
            return SeatProgress.DELIVERED
        if application.id in shipped:
            return SeatProgress.SHIPPED
        return SeatProgress.ACCEPTED

    return {application.id: one(application) for application in applications}


def drop_stage_expr(now: datetime) -> ColumnElement[str]:
    """SQL ``CASE`` computing ``DropStage`` for the ``drops`` row in scope."""

    has_live_seat = exists(
        select(DropApplication.id).where(DropApplication.drop_id == Drop.id, seat_is_live())
    )
    return case(
        (Drop.published_at.is_(None), DropStage.DRAFT.value),
        (Drop.canceled_at.is_not(None), DropStage.CANCELED.value),
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


def drop_running() -> ColumnElement[bool]:
    """Published and neither wrapped nor canceled (hidden is its own check)."""

    return and_(
        Drop.published_at.is_not(None), Drop.wrapped_at.is_(None), Drop.canceled_at.is_(None)
    )


_DROP_REFUSAL_MESSAGES = {
    errors.DROP_CANCELED: "This drop was canceled.",
    errors.DROP_UNPUBLISHED: "This drop is not published.",
    errors.DROP_HIDDEN: "This drop is hidden.",
    errors.DROP_WRAPPED: "This drop is wrapped up.",
    errors.APPLY_WINDOW_OPEN: "Applications are still open for this drop.",
}


def require_drop(
    drop: Drop,
    *,
    published: bool = False,
    visible: bool = False,
    unwrapped: bool = False,
    applications_closed: bool = False,
) -> None:
    """The one guard for acting on a drop; each refused state has its own code (409).

    A canceled drop is always refused (frozen: no seats, decisions, shipments
    or links). The flags add the other states the caller needs the drop in.
    """

    refusals = (
        (drop.canceled_at is not None, errors.DROP_CANCELED),
        (published and drop.published_at is None, errors.DROP_UNPUBLISHED),
        (visible and drop.hidden_at is not None, errors.DROP_HIDDEN),
        (unwrapped and drop.wrapped_at is not None, errors.DROP_WRAPPED),
        (applications_closed and not apply_window_closed(drop, utcnow()), errors.APPLY_WINDOW_OPEN),
    )
    for refused, code in refusals:
        if refused:
            raise BuzzAPIException(code, _DROP_REFUSAL_MESSAGES[code], status_code=409)


def apply_window_closed(drop: Drop, now: datetime) -> bool:
    """Applications closed: the close date has passed."""

    return now > as_utc(drop.apply_close_at)


def org_link_open(drop: Drop, now: datetime) -> bool:
    """Whether the org itself may link/unlink posts (BUZZ View as always may)."""

    if drop.hidden_at is not None or drop.canceled_at is not None:
        return False
    if drop.wrapped_at is None:
        return True
    return now < as_utc(drop.wrapped_at) + ORG_LINK_GRACE


def _open_until_after_wrap(window: timedelta) -> ColumnElement[bool]:
    cutoff = utcnow() - window
    return and_(
        Drop.published_at.is_not(None),
        Drop.hidden_at.is_(None),
        Drop.canceled_at.is_(None),
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
