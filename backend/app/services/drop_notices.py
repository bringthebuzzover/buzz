"""Drop lifecycle emails (plan §3.6).

One email per (seat or drop, event): the Resend idempotency key is the row id
plus the event, so a retried request never mails twice. Orgs hear only about
their own seat. Brands get one email per drop event (close, wrap, cancel),
never one per seat. A failed send is logged and never blocks the action.

| Event | To |
|---|---|
| Decisions sent | each accepted org ("good news"), each denied org |
| First shipment, and every one after | that org, with tracking |
| Org withdraws | that org (confirmation) and BUZZ ops |
| Applications closed, then +2 and +5 days | the brand: "Choose your orgs" (last copies ops) |
| Wrap-up | leftover applicants "not selected" (D-7), live orgs "thanks", the brand a recap |
| Cancel | orgs still in the running, and the brand |
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import timedelta
from typing import Any

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.brand_emails import CONTACT_EMAIL
from app.config import settings
from app.models.application import DropApplication
from app.models.brand import Brand
from app.models.drop import Drop
from app.models.enums import ApplicationDecision, BrandStatus
from app.models.organization import Organization
from app.models.user import User
from app.services.email import (
    KIND_APPLICATION_DENIED,
    KIND_CHOOSE_ORGS,
    KIND_DROP_CANCELED,
    KIND_DROP_CANCELED_ORG,
    KIND_DROP_WRAPPED,
    KIND_DROP_WRAPPED_ORG,
    KIND_SEAT_ACCEPTED,
    KIND_SEAT_SHIPPED,
    KIND_SEAT_WITHDREW,
    KIND_SEAT_WITHDREW_OPS,
    _ops_cc,
    build_idempotency_key,
    idempotency_generation,
    send_application_denied_email,
    send_lifecycle_email,
)
from app.services.lifecycle import ORG_LINK_GRACE, drop_running
from app.timeutils import as_utc, utcnow

logger = logging.getLogger(__name__)

# "Choose your orgs" goes out at close, then twice more if nobody is chosen.
# The last one copies BUZZ ops: that is when BUZZ steps in (D-2).
CHOOSE_ORGS_AFTER_CLOSE = (timedelta(0), timedelta(days=2), timedelta(days=5))


def _campaign_url(application: DropApplication) -> str:
    return f"{settings.FRONTEND_URL}/org/campaigns/{application.id}"


def _brand_drop_url(drop: Drop) -> str:
    return f"{settings.FRONTEND_URL}/brand/drops/{drop.id}"


async def _send(kind: str, key: tuple[object, ...], to: str, **email: Any) -> bool:
    ok = await send_lifecycle_email(to, idempotency_key=build_idempotency_key(kind, *key), **email)
    if not ok:
        logger.warning("%s email not sent: key=%s", kind, key[0])
    return ok


async def _brand(db: AsyncSession, drop: Drop) -> Brand | None:
    brand = await db.get(Brand, drop.brand_id)
    return brand if brand is not None and (brand.company_email or "").strip() else None


async def _orgs(
    db: AsyncSession, applications: Sequence[DropApplication]
) -> list[tuple[DropApplication, str, str]]:
    """(seat, org email, org name) for each seat whose org has an address."""

    by_org = {a.org_id: a for a in applications}
    if not by_org:
        return []
    rows = await db.execute(
        select(Organization.id, Organization.org_name, User.edu_email)
        .join(User, User.id == Organization.user_id)
        .where(Organization.id.in_(list(by_org)))
    )
    return [
        (by_org[org_id], email.strip(), org_name or "your organization")
        for org_id, org_name, email in rows.all()
        if email and email.strip()
    ]


async def notify_decisions(db: AsyncSession, drop: Drop, sent: Sequence[DropApplication]) -> None:
    """Accepted orgs get the good news, denied orgs the "not selected" email."""

    brand = await db.get(Brand, drop.brand_id)
    brand_name = brand.brand_name if brand is not None else ""
    for application, to, org_name in await _orgs(db, sent):
        if application.decision == ApplicationDecision.ACCEPTED.value:
            units = application.allocated_units
            await _send(
                KIND_SEAT_ACCEPTED,
                (application.id, idempotency_generation(application.decision_sent_at)),
                to,
                subject=f"Good news: you're in for {drop.title}",
                paragraphs=[
                    f"{org_name} was selected for {drop.title} from {brand_name or 'the brand'}.",
                    (f"{units} units are set aside for you. " if units else "")
                    + "Open the campaign to check your shipping address and see what to post.",
                ],
                url=_campaign_url(application),
                button="Open campaign",
            )
        elif application.decision == ApplicationDecision.DENIED.value:
            ok = await send_application_denied_email(
                to,
                org_name=org_name,
                drop_title=drop.title,
                brand_name=brand_name,
                idempotency_key=build_idempotency_key(KIND_APPLICATION_DENIED, application.id),
            )
            if not ok:
                logger.warning("application-denied email not sent: key=%s", application.id)


async def notify_shipped(
    db: AsyncSession, application: DropApplication, shipment: dict[str, Any]
) -> None:
    """Tell the org its package is on the way. Silent once the drop is wrapped up."""

    drop = await db.get(Drop, application.drop_id)
    if drop is None or drop.wrapped_at is not None:
        return
    for _, to, org_name in await _orgs(db, [application]):
        tracking = f"{str(shipment['carrier']).upper()} {shipment['tracking_number']}"
        await _send(
            KIND_SEAT_SHIPPED,
            (shipment["id"],),
            to,
            subject=f"Your {drop.title} package shipped",
            paragraphs=[
                f"The package for {org_name} is on the way. Tracking: {tracking}.",
                'Once it arrives, tap "I got it" on the campaign, then post and link your posts.',
            ],
            url=shipment.get("track_url") or _campaign_url(application),
            button="Track package" if shipment.get("track_url") else "Open campaign",
        )


async def notify_withdrew(db: AsyncSession, application: DropApplication) -> None:
    """Confirm to the org, and tell BUZZ ops so they can find a substitute."""

    drop = await db.get(Drop, application.drop_id)
    if drop is None:
        return
    generation = idempotency_generation(application.decision_sent_at)
    for _, to, org_name in await _orgs(db, [application]):
        await _send(
            KIND_SEAT_WITHDREW,
            (application.id, generation),
            to,
            subject=f"You've withdrawn from {drop.title}",
            paragraphs=[
                f"{org_name} is no longer part of {drop.title}.",
                "Changed your mind? You can apply again while applications are open.",
            ],
            url=f"{settings.FRONTEND_URL}/org/browse",
            button="Browse drops",
        )
        await _send(
            KIND_SEAT_WITHDREW_OPS,
            (application.id, generation),
            CONTACT_EMAIL,
            subject=f"{org_name} withdrew from {drop.title}",
            paragraphs=[f"{org_name} withdrew from {drop.title}. Late-add a substitute if needed."],
            url=f"{settings.FRONTEND_URL}/admin/drops/{drop.id}",
            button="Open drop",
            cc=_ops_cc(exclude=CONTACT_EMAIL),
        )


async def notify_wrapped(
    db: AsyncSession, drop: Drop, not_selected: Sequence[DropApplication]
) -> None:
    """Leftover applicants hear "not selected", live orgs get thanks, the brand a recap."""

    await notify_decisions(db, drop, not_selected)
    if drop.wrapped_at is None:
        return
    generation = idempotency_generation(drop.wrapped_at)
    live = list(
        await db.scalars(
            select(DropApplication).where(
                DropApplication.drop_id == drop.id,
                DropApplication.decision == ApplicationDecision.ACCEPTED.value,
                DropApplication.decision_sent_at.is_not(None),
            )
        )
    )
    links_until = (as_utc(drop.wrapped_at) + ORG_LINK_GRACE).strftime("%b %-d")
    for application, to, org_name in await _orgs(db, live):
        await _send(
            KIND_DROP_WRAPPED_ORG,
            (application.id, generation),
            to,
            subject=f"{drop.title} is wrapped up: thank you",
            paragraphs=[
                f"Thanks for taking part in {drop.title}, {org_name}.",
                f"You can still link posts until {links_until}, so they count in the results.",
            ],
            url=_campaign_url(application),
            button="Link posts",
        )
    brand = await _brand(db, drop)
    if brand is not None:
        await _send(
            KIND_DROP_WRAPPED,
            (drop.id, generation),
            brand.company_email.strip(),
            subject=f"{drop.title} is wrapped up",
            paragraphs=[
                f"{drop.title} is over. {len(live)} organizations took part.",
                "Results keep updating for a few weeks as late posts are linked and metrics sync.",
            ],
            url=_brand_drop_url(drop),
            button="See results",
        )


async def notify_canceled(db: AsyncSession, drop: Drop) -> None:
    """Every org still in the running (applied or accepted) and the brand, once each."""

    seats = list(
        await db.scalars(
            select(DropApplication).where(
                DropApplication.drop_id == drop.id,
                DropApplication.decision.in_(
                    (ApplicationDecision.APPLIED.value, ApplicationDecision.ACCEPTED.value)
                ),
            )
        )
    )
    for application, to, org_name in await _orgs(db, seats):
        await _send(
            KIND_DROP_CANCELED_ORG,
            (application.id,),
            to,
            subject=f"{drop.title} was canceled",
            paragraphs=[
                f"{drop.title} was canceled, so {org_name} has nothing more to do for it.",
                "If a package already reached you, reply to this email and we'll sort it out.",
            ],
            url=f"{settings.FRONTEND_URL}/org/browse",
            button="Browse drops",
        )
    brand = await _brand(db, drop)
    if brand is not None:
        await _send(
            KIND_DROP_CANCELED,
            (drop.id,),
            brand.company_email.strip(),
            subject=f"{drop.title} was canceled",
            paragraphs=[
                f"{drop.title} was canceled and is off the Drop Feed. The organizations involved "
                "were told.",
                "Posts already linked stay in your report.",
            ],
            url=_brand_drop_url(drop),
            button="View drop",
        )


async def send_choose_orgs_reminders(db: AsyncSession) -> dict[str, int]:
    """Ask the brand to choose once applications close, then at +2 and +5 days.

    Only while the drop is in Selecting (closed, nobody accepted yet) and some
    applicant is still waiting. ``drops.choose_orgs_emails_sent`` counts the
    emails; a late run sends just the latest one due, never a burst.
    """

    now = utcnow()
    waiting = exists().where(
        DropApplication.drop_id == Drop.id, DropApplication.decision_sent_at.is_(None)
    )
    live = exists().where(
        DropApplication.drop_id == Drop.id,
        DropApplication.decision == ApplicationDecision.ACCEPTED.value,
        DropApplication.decision_sent_at.is_not(None),
    )
    rows = (
        await db.execute(
            select(Drop, Brand)
            .join(Brand, Brand.id == Drop.brand_id)
            .where(
                drop_running(),
                Drop.hidden_at.is_(None),
                Drop.apply_close_at <= now,
                Drop.choose_orgs_emails_sent < len(CHOOSE_ORGS_AFTER_CLOSE),
                Brand.status == BrandStatus.APPROVED.value,
                waiting,
                ~live,
            )
            .with_for_update(of=Drop, skip_locked=True)
        )
    ).all()

    sent = 0
    for drop, brand in rows:
        closed_at = as_utc(drop.apply_close_at)
        due = sum(1 for after in CHOOSE_ORGS_AFTER_CLOSE if closed_at + after <= now)
        if due <= drop.choose_orgs_emails_sent or not (brand.company_email or "").strip():
            continue
        last = due == len(CHOOSE_ORGS_AFTER_CLOSE)
        steps_in = (closed_at + CHOOSE_ORGS_AFTER_CLOSE[-1]).strftime("%b %-d")
        ok = await _send(
            KIND_CHOOSE_ORGS,
            (drop.id, str(due)),
            brand.company_email.strip(),
            subject=f"Choose your orgs for {drop.title}",
            paragraphs=[
                f"Applications for {drop.title} are closed. Pick the organizations you want "
                "and send your decisions.",
                (
                    "BUZZ is copied and will help choose from here."
                    if last
                    else f"Want BUZZ to choose? Just wait: we step in on {steps_in}."
                ),
            ],
            url=_brand_drop_url(drop),
            button="Choose your orgs",
            cc=_ops_cc(exclude=brand.company_email) if last else None,
        )
        if ok:
            drop.choose_orgs_emails_sent = due
            sent += 1
    await db.flush()
    return {"choose_orgs_sent": sent}
