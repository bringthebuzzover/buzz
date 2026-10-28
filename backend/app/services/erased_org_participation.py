"""Remove an org's campaign seats, posts, and stored metrics.

Brand, admin, and dashboard totals are live sums over ``post_campaign_links``,
``drop_applications``, and ``social_posts`` numeric columns. There is no
stored aggregate. Deleting those rows is what keeps a deleted org out of
every reader (drop pages, campaign lists, dashboards, admin counts, insight
columns). PRODUCT §3.1.2.

``cleanup_statements`` is the single statement list. Erase runs it for one
org. The data migration runs the ``all_erased`` list for rows already
erased under the old keep-KPI rule. Both are safe to run twice.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import DropApplication
from app.models.enums import OrgUserStatus, PortalRole
from app.models.notify_me import NotifyMe
from app.models.organization import Organization
from app.models.post_link import PostCampaignLink
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.shipment import DropApplicationShipment
from app.models.social_post import SocialPost
from app.models.user import User

# Rows the DELETE statements remove. Expunge them so a later flush cannot
# write a detached in-memory copy back over the delete.
_REMOVED_TYPES = (
    DropApplication,
    DropApplicationShipment,
    NotifyMe,
    PostCampaignLink,
    PostCampaignSuggestion,
    SocialPost,
)


def cleanup_statements(mode: str) -> list[str]:
    """SQL that withdraws campaign participation.

    ``one`` — ``:org_id`` only (erase, including before ``users.status`` flips).
    ``all_erased`` — every org user already ``status = erased`` (heal / migration).
    """

    if mode == "one":
        pred = "o.id = :org_id"
    elif mode == "all_erased":
        pred = "u.portal_role = 'org' AND u.status = 'erased'"
    else:
        raise ValueError(f"unknown cleanup mode: {mode}")

    orgs = "SELECT o.id FROM organizations o " "JOIN users u ON u.id = o.user_id " f"WHERE {pred}"
    apps = f"SELECT a.id FROM drop_applications a WHERE a.org_id IN ({orgs})"
    posts = f"SELECT p.id FROM social_posts p WHERE p.org_id IN ({orgs})"
    return [
        (
            "DELETE FROM post_campaign_suggestions "
            f"WHERE application_id IN ({apps}) OR post_id IN ({posts})"
        ),
        (
            "DELETE FROM post_campaign_links "
            f"WHERE application_id IN ({apps}) OR post_id IN ({posts})"
        ),
        f"DELETE FROM drop_application_shipments WHERE application_id IN ({apps})",
        f"DELETE FROM drop_applications WHERE org_id IN ({orgs})",
        f"DELETE FROM social_posts WHERE org_id IN ({orgs})",
        f"DELETE FROM notify_me WHERE org_id IN ({orgs})",
        f"UPDATE organizations SET follower_count = NULL WHERE id IN ({orgs})",
    ]


def _expunge_removed(
    db: AsyncSession,
    *,
    org_ids: set[UUID],
    application_ids: set[UUID],
    post_ids: set[UUID],
) -> None:
    """Drop deleted instances only. Leave every other org's rows attached."""

    for obj in list(db.sync_session.identity_map.values()):
        remove = False
        if isinstance(obj, (SocialPost, DropApplication, NotifyMe)):
            remove = obj.org_id in org_ids
        elif isinstance(obj, (PostCampaignLink, PostCampaignSuggestion)):
            remove = obj.application_id in application_ids or obj.post_id in post_ids
        elif isinstance(obj, DropApplicationShipment):
            remove = obj.application_id in application_ids
        if remove and isinstance(obj, _REMOVED_TYPES):
            db.expunge(obj)


async def _target_org_ids(db: AsyncSession, org_id: UUID | None) -> set[UUID]:
    if org_id is not None:
        return {org_id}
    rows = await db.scalars(
        select(Organization.id)
        .join(User, User.id == Organization.user_id)
        .where(
            User.portal_role == PortalRole.ORG.value,
            User.status == OrgUserStatus.ERASED.value,
        )
    )
    return set(rows)


async def withdraw_org_campaign_participation(
    db: AsyncSession,
    *,
    org_id: UUID | None = None,
) -> None:
    """Delete seats, links, shipments, posts, and follower_count.

    Pass ``org_id`` for the org being erased. Omit it to heal every org
    user that is already erased. Idempotent.
    """

    org_ids = await _target_org_ids(db, org_id)
    application_ids: set[UUID] = set()
    post_ids: set[UUID] = set()
    if org_ids:
        application_ids = set(
            await db.scalars(select(DropApplication.id).where(DropApplication.org_id.in_(org_ids)))
        )
        post_ids = set(
            await db.scalars(select(SocialPost.id).where(SocialPost.org_id.in_(org_ids)))
        )

    mode = "one" if org_id is not None else "all_erased"
    params = {"org_id": org_id} if org_id is not None else {}
    for statement in cleanup_statements(mode):
        await db.execute(text(statement), params)

    if org_ids:
        for org in await db.scalars(select(Organization).where(Organization.id.in_(org_ids))):
            # Raw UPDATE does not refresh the identity map. Pin None so a
            # later flush of this instance cannot restore the old count.
            org.follower_count = None

    _expunge_removed(
        db,
        org_ids=org_ids,
        application_ids=application_ids,
        post_ids=post_ids,
    )
    await db.flush()
