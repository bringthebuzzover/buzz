"""My-Campaigns orchestration (architecture.md §7.2/§7.3).

A "campaign" is an org's ``drop_applications`` row joined with its parent drop.
Denied applications are invisible to the org (filtered from the list, 404 on
detail). The list is sorted server-side per §7.2: active → accepted → applied →
finished, most-recently-applied first within each group.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.enums import ApplicationDecision, BrandTrackerStage
from app.models.organization import Organization
from app.models.user import User
from app.schemas.campaigns import CampaignDetailResponse, CampaignListItem

# §7.2 group ordering. The stage constants use the *current* backend enum; the
# D1 migration (Stage 5C) swaps these two values to the §8.5 vocabulary
# (``drop_active`` / ``drop_finished``) without changing the bucket logic.
_STAGE_ACTIVE = BrandTrackerStage.ACTIVE.value
_STAGE_FINISHED = BrandTrackerStage.FINISHED.value


def _campaign_sort_bucket(decision: str, stage: str) -> int:
    """Lower sorts first: active(0) → accepted(1) → applied(2) → finished(3)."""

    if decision == ApplicationDecision.ACCEPTED.value:
        if stage == _STAGE_ACTIVE:
            return 0
        if stage == _STAGE_FINISHED:
            return 3
        return 1
    # Only non-denied decisions reach here; ``applied`` (and any future
    # non-denied state) sort into the "applied" group.
    return 2


async def list_my_campaigns(db: AsyncSession, org_user: User) -> list[CampaignListItem]:
    """All non-denied applications for the caller org, joined + sorted (§7.2)."""

    org_id = await db.scalar(select(Organization.id).where(Organization.user_id == org_user.id))
    if org_id is None:
        return []

    rows = list(
        (
            await db.execute(
                select(DropApplication, Drop)
                .join(Drop, Drop.id == DropApplication.drop_id)
                .where(
                    DropApplication.org_id == org_id,
                    DropApplication.decision != ApplicationDecision.DENIED.value,
                )
            )
        ).all()
    )

    # ``id`` is the stable tiebreaker: ``applied_at`` defaults to the transaction
    # clock, so rows created in one transaction collide and same-bucket order
    # would otherwise be whatever the DB happened to return (mirrors the feed's
    # ``Drop.id`` tiebreaker).
    rows.sort(
        key=lambda pair: (
            _campaign_sort_bucket(pair[0].decision, pair[1].brand_tracker_stage),
            -pair[0].applied_at.timestamp(),
            str(pair[0].id),
        )
    )

    return [
        CampaignListItem(
            id=application.id,
            drop_id=application.drop_id,
            decision=application.decision,
            pitch=application.pitch,
            tracking_number=application.tracking_number,
            allocated_units=application.allocated_units,
            applied_at=application.applied_at,
            decision_at=application.decision_at,
            title=drop.title,
            brand_name=drop.brand_name,
            brand_tracker_stage=drop.brand_tracker_stage,
            image=drop.image,
        )
        for application, drop in rows
    ]


async def resolve_owned_application(
    db: AsyncSession,
    org_user: User,
    application_id: uuid.UUID,
) -> DropApplication:
    """Load an application the caller org owns, or raise 404.

    Unknown / other-org / denied all collapse to the same 404 (no existence
    leak). Shared by every ``/api/campaigns/{id}/*`` sub-resource so they
    enforce ownership uniformly (no IDOR).
    """

    org_id = await db.scalar(select(Organization.id).where(Organization.user_id == org_user.id))
    application = await db.get(DropApplication, application_id)
    if (
        application is None
        or org_id is None
        or application.org_id != org_id
        or application.decision == ApplicationDecision.DENIED.value
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
            select(DropApplication, Drop)
            .join(Drop, Drop.id == DropApplication.drop_id)
            .where(DropApplication.id == application_id)
        )
    ).first()

    if row is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Campaign not found.", status_code=404)

    application, drop = row
    # Ownership + denied-invisibility collapse to the same 404 (don't leak
    # existence of other orgs' or denied applications).
    if (
        org_id is None
        or application.org_id != org_id
        or application.decision == ApplicationDecision.DENIED.value
    ):
        raise BuzzAPIException(errors.NOT_FOUND, "Campaign not found.", status_code=404)

    return CampaignDetailResponse(
        id=application.id,
        drop_id=application.drop_id,
        org_id=application.org_id,
        decision=application.decision,
        pitch=application.pitch,
        tracking_number=application.tracking_number,
        allocated_units=application.allocated_units,
        applied_at=application.applied_at,
        decision_at=application.decision_at,
        title=drop.title,
        brand_name=drop.brand_name,
        image=drop.image,
        brand_tracker_stage=drop.brand_tracker_stage,
        apply_open_at=drop.apply_open_at,
        apply_close_at=drop.apply_close_at,
        capacity_total=drop.capacity_total,
        total_product_units=drop.total_product_units,
    )
