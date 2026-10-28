"""Admin removal of one org from one drop.

For test data and mistakes. Erase does not do this: erase freezes metrics.
Removing the seat deletes that drop's application, its shipments, its post
link, and the linked post, so live totals fall. The drop's published capacity
is unchanged. A later metric sync can rediscover a still-active org's media;
an erased org is not synced.
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.admin_audit_event import AdminAuditEvent
from app.models.application import DropApplication
from app.models.enums import OrgUserStatus
from app.models.organization import Organization
from app.models.post_link import PostCampaignLink
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.shipment import DropApplicationShipment
from app.models.social_post import SocialPost
from app.models.user import User

logger = logging.getLogger(__name__)

REMOVE_CONFIRM = "remove"


async def remove_participant_from_drop(
    db: AsyncSession,
    *,
    actor_id: UUID,
    drop_id: UUID,
    application_id: UUID,
    confirm: str,
) -> dict[str, object]:
    """Delete one seat and its linked metrics. Confirm must be ``remove``."""

    if confirm.strip().casefold() != REMOVE_CONFIRM:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "Type remove to confirm.",
            status_code=400,
        )

    application = await db.get(DropApplication, application_id)
    if application is None or application.drop_id != drop_id:
        raise BuzzAPIException(
            errors.NOT_FOUND, "Participant not found on this drop.", status_code=404
        )

    # Snapshot before the bulk deletes. SQLAlchemy expires the loaded row, and
    # reading it afterward would refresh a row that is already gone.
    saved_application_id = application.id
    saved_org_id = application.org_id
    saved_drop_id = application.drop_id
    allocated_units = application.allocated_units

    org = await db.get(Organization, saved_org_id)
    user = await db.get(User, org.user_id) if org is not None else None
    account_erased = user is not None and user.status == OrgUserStatus.ERASED.value

    post_ids = list(
        await db.scalars(
            select(PostCampaignLink.post_id).where(
                PostCampaignLink.application_id == saved_application_id
            )
        )
    )
    shipment_count = int(
        await db.scalar(
            select(func.count())
            .select_from(DropApplicationShipment)
            .where(DropApplicationShipment.application_id == saved_application_id)
        )
        or 0
    )

    sug = [PostCampaignSuggestion.application_id == saved_application_id]
    if post_ids:
        sug.append(PostCampaignSuggestion.post_id.in_(post_ids))
    await db.execute(delete(PostCampaignSuggestion).where(or_(*sug)))
    await db.execute(
        delete(PostCampaignLink).where(PostCampaignLink.application_id == saved_application_id)
    )
    await db.execute(
        delete(DropApplicationShipment).where(
            DropApplicationShipment.application_id == saved_application_id
        )
    )
    await db.execute(delete(DropApplication).where(DropApplication.id == saved_application_id))
    if post_ids:
        await db.execute(delete(SocialPost).where(SocialPost.id.in_(post_ids)))

    detail = {
        "posts_removed": len(post_ids),
        "shipments_removed": shipment_count,
        "allocated_units": allocated_units,
        "account_erased": account_erased,
    }
    db.add(
        AdminAuditEvent(
            actor_user_id=actor_id,
            action="participant_removed",
            drop_id=saved_drop_id,
            org_id=saved_org_id,
            application_id=saved_application_id,
            detail=detail,
        )
    )
    await db.flush()
    logger.info(
        "participant_removed actor_user_id=%s drop_id=%s org_id=%s "
        "application_id=%s posts=%s shipments=%s",
        actor_id,
        saved_drop_id,
        saved_org_id,
        saved_application_id,
        len(post_ids),
        shipment_count,
    )
    return {
        "drop_id": saved_drop_id,
        "application_id": saved_application_id,
        "org_id": saved_org_id,
        "posts_removed": len(post_ids),
        "shipments_removed": shipment_count,
    }
