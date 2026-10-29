"""My-Campaigns orchestration (buzz-ops engineering/architecture.md §7.2/§7.3).

A "campaign" is an org's ``drop_applications`` row joined with its parent drop.
The org only sees *sent* decisions (``lifecycle.org_visible_decision``): a
drafted accept/deny still reads ``applied``, and an ended seat (sent denial,
withdrawal, removal) is invisible (filtered from the list, 404 on detail).
The list is sorted server-side per §7.2: live → accepted → applied →
wrapped/canceled, most-recently-applied first.
"""

from __future__ import annotations

import uuid

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.brand import Brand
from app.models.drop import Drop
from app.models.enums import ApplicationDecision, DropStage
from app.models.organization import Organization
from app.models.shipment import DropApplicationShipment
from app.models.user import User
from app.schemas.campaigns import CampaignDetailResponse, CampaignListItem
from app.services.drop_notices import notify_withdrew
from app.services.lifecycle import (
    ORG_HIDDEN_DECISIONS,
    drop_stages,
    org_link_open,
    org_visible_decision,
    seat_hidden_from_org,
    seat_progress,
)
from app.services.seats import end_seat, lock_drop
from app.services.shipments import set_delivered, shipments_by_application_ids
from app.timeutils import utcnow


def _campaign_sort_bucket(decision: str, stage: DropStage) -> int:
    """Lower sorts first: live(0) → accepted(1) → applied(2) → over(3)."""

    if stage in (DropStage.WRAPPED, DropStage.CANCELED):
        return 3
    if decision == ApplicationDecision.ACCEPTED.value:
        if stage == DropStage.LIVE:
            return 0
        return 1
    return 2


def _org_seat_fields(application: DropApplication) -> dict[str, object]:
    """Seat fields as the org may see them (drafted decisions stay hidden)."""

    sent = application.decision_sent_at is not None
    return {
        "decision": org_visible_decision(application),
        "allocated_units": application.allocated_units if sent else None,
        "decision_at": application.decision_sent_at if sent else None,
        "delivered_at": application.delivered_at,
    }


async def list_my_campaigns(db: AsyncSession, org_user: User) -> list[CampaignListItem]:
    """All of the caller org's seats except ended ones, joined + sorted (§7.2)."""

    org_id = await db.scalar(select(Organization.id).where(Organization.user_id == org_user.id))
    if org_id is None:
        return []

    rows = list(
        (
            await db.execute(
                select(DropApplication, Drop, Brand)
                .join(Drop, Drop.id == DropApplication.drop_id)
                .join(Brand, Brand.id == Drop.brand_id)
                .where(
                    DropApplication.org_id == org_id,
                    ~seat_hidden_from_org(),
                    Drop.hidden_at.is_(None),
                )
            )
        ).all()
    )

    # ``id`` is the stable tiebreaker: ``applied_at`` defaults to the transaction
    # clock, so rows created in one transaction collide and same-bucket order
    # would otherwise be whatever the DB happened to return (mirrors the feed's
    # ``Drop.id`` tiebreaker).
    now = utcnow()
    stages = await drop_stages(db, list({drop.id for _, drop, _ in rows}), now=now)
    rows.sort(
        key=lambda pair: (
            _campaign_sort_bucket(org_visible_decision(pair[0]), stages[pair[1].id]),
            -pair[0].applied_at.timestamp(),
            str(pair[0].id),
        )
    )

    shipment_map = await shipments_by_application_ids(
        db, [application.id for application, _, _ in rows]
    )
    progress = await seat_progress(db, [application for application, _, _ in rows])
    return [
        CampaignListItem(
            id=application.id,
            drop_id=application.drop_id,
            pitch=application.pitch,
            shipments=shipment_map.get(application.id, []),
            applied_at=application.applied_at,
            title=drop.title,
            brand_name=brand.brand_name,
            stage=stages[drop.id],
            links_open=org_link_open(drop, now),
            image=drop.image,
            progress=progress[application.id],
            **_org_seat_fields(application),
        )
        for application, drop, brand in rows
    ]


async def resolve_owned_application(
    db: AsyncSession,
    org_user: User,
    application_id: uuid.UUID,
    *,
    require_accepted: bool = False,
) -> DropApplication:
    """Load an application the caller org owns, or raise 404.

    Unknown / other-org / ended (sent denial, withdrew, removed) all
    collapse to the same 404 (no existence leak). Shared by every
    ``/api/campaigns/{id}/*`` sub-resource so they enforce ownership
    uniformly (no IDOR).

    ``require_accepted`` additionally collapses seats the org does not *see* as
    accepted (still applied, or accepted but unsent) to 404 — used by the
    post-linking paths. Keeping this off for reads lets an applied org still
    view their pending campaign.
    """

    org_id = await db.scalar(select(Organization.id).where(Organization.user_id == org_user.id))
    application = await db.get(DropApplication, application_id)
    visible = org_visible_decision(application) if application is not None else None
    blocked = visible in ORG_HIDDEN_DECISIONS or (
        require_accepted and visible != ApplicationDecision.ACCEPTED.value
    )
    drop = await db.get(Drop, application.drop_id) if application is not None else None
    if (
        application is None
        or org_id is None
        or application.org_id != org_id
        or blocked
        or drop is None
        or drop.hidden_at is not None
    ):
        raise BuzzAPIException(errors.NOT_FOUND, "Campaign not found.", status_code=404)
    return application


async def get_my_campaign(
    db: AsyncSession,
    org_user: User,
    application_id: uuid.UUID,
) -> CampaignDetailResponse:
    """One campaign for the caller org. 404 if missing, not theirs, or denied."""

    org_id = await db.scalar(select(Organization.id).where(Organization.user_id == org_user.id))
    row = (
        await db.execute(
            select(DropApplication, Drop, Brand)
            .join(Drop, Drop.id == DropApplication.drop_id)
            .join(Brand, Brand.id == Drop.brand_id)
            .where(DropApplication.id == application_id)
        )
    ).first()

    if row is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Campaign not found.", status_code=404)

    application, drop, brand = row
    # Ownership + denied-invisibility collapse to the same 404 (don't leak
    # existence of other orgs' or denied applications).
    if (
        org_id is None
        or application.org_id != org_id
        or org_visible_decision(application) in ORG_HIDDEN_DECISIONS
        or drop.hidden_at is not None
    ):
        raise BuzzAPIException(errors.NOT_FOUND, "Campaign not found.", status_code=404)

    return CampaignDetailResponse(
        id=application.id,
        drop_id=application.drop_id,
        org_id=application.org_id,
        pitch=application.pitch,
        shipments=(await shipments_by_application_ids(db, [application.id]))[application.id],
        applied_at=application.applied_at,
        title=drop.title,
        description=drop.description,
        brand_name=brand.brand_name,
        image=drop.image,
        stage=(await drop_stages(db, [drop.id]))[drop.id],
        links_open=org_link_open(drop, utcnow()),
        progress=(await seat_progress(db, [application]))[application.id],
        **_org_seat_fields(application),
        apply_open_at=drop.apply_open_at,
        apply_close_at=drop.apply_close_at,
        capacity_total=drop.capacity_total,
        total_product_units=drop.total_product_units,
    )


async def withdraw_my_campaign(db: AsyncSession, org_user: User, application_id: uuid.UUID) -> None:
    """The org pulls out: any time while applied, or accepted before it ships.

    After shipping the product may need to come back, so BUZZ handles it.
    """

    application = await resolve_owned_application(db, org_user, application_id)
    await lock_drop(db, application.drop_id)
    if org_visible_decision(application) == ApplicationDecision.ACCEPTED.value and (
        await db.scalar(
            select(exists().where(DropApplicationShipment.application_id == application.id))
        )
    ):
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Your product has already shipped. Contact BUZZ to withdraw.",
            status_code=409,
        )
    await end_seat(db, application, decision=ApplicationDecision.WITHDREW.value, reason=None)
    await notify_withdrew(db, application)


async def set_my_campaign_delivered(
    db: AsyncSession, org_user: User, application_id: uuid.UUID, delivered: bool
) -> None:
    """The org confirms it has the product ("I got it")."""

    application = await resolve_owned_application(
        db, org_user, application_id, require_accepted=True
    )
    await set_delivered(db, application.id, delivered)
