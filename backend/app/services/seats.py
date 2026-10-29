"""Per-seat selection: draft a decision, then "Send decisions" in batches.

Replaces the one-shot drop-wide finalize. Each seat carries its own decision
(``applied`` = undecided, ``accepted``, ``denied``); nothing reaches the org
until ``send_decisions`` stamps ``decision_sent_at`` (and emails denials).
Sending is repeatable, so a brand can accept the first orgs now and the rest
later; undecided seats simply wait.

Who may do what:

* **brand** — after applications close, before wrap-up, on unsent seats only,
  within capacity and the unit budget;
* **BUZZ** — any time, any seat, may overbook. A sent denial can be reversed
  to accepted (unsent again, so it goes out with the next send); a sent
  acceptance keeps its decision and only its units change (it stays live).
  BUZZ also ends seats softly: ``withdrew`` (the org pulled out) or
  ``removed`` (reason required). Those take effect at once and keep the row,
  shipments and posts.

A canceled drop takes no decisions; BUZZ can still end a seat on it.
"""

from __future__ import annotations

import logging
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.brand import Brand
from app.models.drop import Drop
from app.models.enums import ApplicationDecision
from app.models.organization import Organization
from app.models.tracker_event import DropTrackerEvent
from app.models.user import User
from app.services.email import (
    KIND_APPLICATION_DENIED,
    build_idempotency_key,
    send_application_denied_email,
)
from app.services.lifecycle import (
    ENDED_DECISIONS,
    apply_window_closed,
    drop_stage,
    reject_if_canceled,
)
from app.timeutils import utcnow

logger = logging.getLogger(__name__)

Actor = Literal["brand", "admin"]


async def lock_drop(db: AsyncSession, drop_id: object) -> Drop:
    """``SELECT … FOR UPDATE`` the drop (serializes decisions, sends and applies)."""

    drop = await db.scalar(select(Drop).where(Drop.id == drop_id).with_for_update())
    if drop is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop not found.", status_code=404)
    return drop


def _require_visible(drop: Drop) -> None:
    """Seats move only on a published, unhidden drop (any actor)."""

    if drop.published_at is None or drop.hidden_at is not None:
        raise BuzzAPIException(errors.DROP_NOT_OPEN, "This drop is not available.")


def _require_brand_may_select(drop: Drop) -> None:
    _require_visible(drop)
    if drop.wrapped_at is not None:
        raise BuzzAPIException(errors.DROP_WRAPPED, "This drop is wrapped up.")
    if not apply_window_closed(drop, utcnow()):
        raise BuzzAPIException(
            errors.APPLY_WINDOW_OPEN, "Applications are still open for this drop."
        )


async def _taken(db: AsyncSession, drop: Drop, *, excluding: DropApplication) -> tuple[int, int]:
    """(accepted seats, allocated units) on the drop, other than *excluding*."""

    row = (
        await db.execute(
            select(func.count(), func.coalesce(func.sum(DropApplication.allocated_units), 0)).where(
                DropApplication.drop_id == drop.id,
                DropApplication.decision == ApplicationDecision.ACCEPTED.value,
                DropApplication.id != excluding.id,
            )
        )
    ).one()
    return int(row[0] or 0), int(row[1] or 0)


async def set_seat_decision(
    db: AsyncSession,
    drop: Drop,
    application_id: object,
    *,
    decision: str,
    allocated_units: int | None,
    actor: Actor,
    reason: str | None = None,
) -> DropApplication:
    """Draft one seat's decision. *drop* must already be locked (``lock_drop``)."""

    application = await db.get(DropApplication, application_id)
    if application is None or application.drop_id != drop.id:
        raise BuzzAPIException(errors.NOT_FOUND, "Application not found.", status_code=404)
    if application.decision in ENDED_DECISIONS:
        # Withdrew / removed are final; BUZZ brings an org back with a late add.
        raise BuzzAPIException(
            errors.DECISION_ALREADY_SENT,
            "This seat has ended. To bring the organization back, late-add it.",
        )
    if decision in ENDED_DECISIONS:
        if actor != "admin":
            raise BuzzAPIException(errors.FORBIDDEN, "Only BUZZ can end a seat.", status_code=403)
        return await end_seat(db, application, decision=decision, reason=reason)
    reject_if_canceled(drop)

    _require_visible(drop)
    if actor == "brand":
        _require_brand_may_select(drop)
        if application.decision_sent_at is not None:
            raise BuzzAPIException(
                errors.DECISION_ALREADY_SENT,
                "This decision was already sent. Ask BUZZ to change it.",
            )

    if (
        application.decision_sent_at is not None
        and decision != application.decision
        and decision != ApplicationDecision.ACCEPTED.value
    ):
        # A sent decision only moves forward to accepted (BUZZ reversing a
        # denial). Taking back a live seat is a removal, not a re-decision.
        raise BuzzAPIException(
            errors.DECISION_ALREADY_SENT,
            "This decision was already sent. A sent denial can only be reversed to"
            " accepted; to take back a live seat, remove the organization from the drop.",
        )

    units = allocated_units if drop.total_product_units is not None else None
    if decision == ApplicationDecision.ACCEPTED.value:
        taken_seats, taken_units = await _taken(db, drop, excluding=application)
        if actor == "brand" and taken_seats >= drop.capacity_total:
            raise BuzzAPIException(
                errors.CAPACITY_EXCEEDED,
                f"All {drop.capacity_total} spots are already taken.",
            )
        if (
            actor == "brand"
            and drop.total_product_units is not None
            and taken_units + (units or 0) > drop.total_product_units
        ):
            remaining = max(0, drop.total_product_units - taken_units)
            raise BuzzAPIException(
                errors.UNIT_BUDGET_EXCEEDED,
                f"Only {remaining} units are left to allocate.",
                details={"remaining": remaining},
            )
    else:
        units = None

    if decision == application.decision:
        # Same decision: at most a units change. A sent acceptance stays sent
        # (the seat stays live), so re-allocating units never un-sends it.
        if units != application.allocated_units:
            application.allocated_units = units
            await db.flush()
        return application
    application.decision = decision
    application.allocated_units = units
    application.decision_at = None if decision == ApplicationDecision.APPLIED.value else utcnow()
    application.decision_sent_at = None
    application.end_reason = None
    try:
        await db.flush()
    except IntegrityError as exc:
        # uq_drop_application_active: the org already holds another live seat
        # (it re-applied after this denial), so this row cannot come back.
        raise BuzzAPIException(
            errors.ALREADY_APPLIED,
            "This organization already has another application on this drop.",
        ) from exc
    return application


async def end_seat(
    db: AsyncSession, application: DropApplication, *, decision: str, reason: str | None
) -> DropApplication:
    """End a seat softly (``withdrew`` / ``removed``), effective at once.

    The row, its shipments and its linked posts stay: posts still count in
    the brand report but can no longer be linked or unlinked (D-8). The spot
    and its units free up. ``removed`` needs a reason.
    """

    if (
        application.decision == ApplicationDecision.DENIED.value
        and application.decision_sent_at is not None
    ):
        raise BuzzAPIException(
            errors.DECISION_ALREADY_SENT, "This organization was denied; there is no seat to end."
        )
    cleaned = (reason or "").strip() or None
    if decision == ApplicationDecision.REMOVED.value and cleaned is None:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR, "Say why the seat is removed.", status_code=400
        )
    now = utcnow()
    application.decision = decision
    application.allocated_units = None
    application.decision_at = now
    application.decision_sent_at = now
    application.end_reason = cleaned
    await db.flush()
    return application


async def send_decisions(db: AsyncSession, drop: Drop, *, actor: Actor) -> dict[str, int]:
    """Send every decided, unsent seat. *drop* must already be locked.

    Denied orgs get the denial email (their only channel). Accepted orgs see
    the campaign in My Campaigns from now on.
    """

    reject_if_canceled(drop)
    _require_visible(drop)
    if actor == "brand":
        _require_brand_may_select(drop)

    pending = list(
        await db.scalars(
            select(DropApplication).where(
                DropApplication.drop_id == drop.id,
                DropApplication.decision != ApplicationDecision.APPLIED.value,
                DropApplication.decision_sent_at.is_(None),
            )
        )
    )
    now = utcnow()
    for application in pending:
        application.decision_sent_at = now
    accepted = sum(1 for a in pending if a.decision == ApplicationDecision.ACCEPTED.value)
    denied = [a for a in pending if a.decision == ApplicationDecision.DENIED.value]
    if pending:
        db.add(
            DropTrackerEvent(
                drop_id=drop.id,
                stage=(await drop_stage(db, drop)).value,
                note=f"decisions sent by {actor}: {accepted} accepted, {len(denied)} denied",
            )
        )
    await db.flush()

    if denied:
        await _email_denials(db, drop, denied)
    return {"accepted_count": accepted, "denied_count": len(denied)}


async def _email_denials(db: AsyncSession, drop: Drop, denied: list[DropApplication]) -> None:
    brand = await db.get(Brand, drop.brand_id)
    brand_name = brand.brand_name if brand is not None else ""
    app_by_org = {a.org_id: a for a in denied}
    contacts = await db.execute(
        select(User.edu_email, Organization.org_name, Organization.id)
        .join(User, User.id == Organization.user_id)
        .where(Organization.id.in_(list(app_by_org)))
    )
    for edu_email, org_name, org_id in contacts.all():
        if not edu_email:
            continue
        ok = await send_application_denied_email(
            edu_email,
            org_name=org_name,
            drop_title=drop.title,
            brand_name=brand_name,
            idempotency_key=build_idempotency_key(KIND_APPLICATION_DENIED, app_by_org[org_id].id),
        )
        if not ok:
            logger.warning("application-denied email failed: drop_id=%s org_id=%s", drop.id, org_id)
