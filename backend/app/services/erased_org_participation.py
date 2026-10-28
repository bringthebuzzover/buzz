"""Freeze an erased org's campaign metrics and strip Instagram identifiers.

Brand totals are live sums over linked posts. Erase keeps the accepted seat,
the link, and the last numeric snapshot, and stops Instagram refresh. The
statements here are what the data migration runs for orgs already erased.
Erase itself updates the loaded rows in the session (same fields) so a later
flush cannot write the old permalinks back.

Retained on the post: likes, comments, reach, views, saved, shares, and the
other numeric insight columns. Cleared: media id, permalink, media URLs,
thumbnail, caption, and raw insight payload. ``follower_count`` and
``university`` are cleared. Campus totals skip a blank university.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import DropApplication
from app.models.enums import OrgUserStatus, PortalRole
from app.models.notify_me import NotifyMe
from app.models.organization import Organization
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.social_post import SocialPost
from app.models.user import User


def frozen_external_id(post_id: UUID) -> str:
    """Non-Graph id. Not an Instagram media id."""

    return f"frozen-{post_id}"


def freeze_statements() -> list[str]:
    """Idempotent SQL for every erased org. Does not delete seats or posts."""

    pred = "u.portal_role = 'org' AND u.status = 'erased'"
    orgs = "SELECT o.id FROM organizations o " "JOIN users u ON u.id = o.user_id " f"WHERE {pred}"
    apps = f"SELECT a.id FROM drop_applications a WHERE a.org_id IN ({orgs})"
    posts = f"SELECT p.id FROM social_posts p WHERE p.org_id IN ({orgs})"
    return [
        (
            "UPDATE social_posts AS p SET "
            "metrics_frozen_at = COALESCE(p.metrics_frozen_at, now()), "
            "external_id = 'frozen-' || p.id::text, "
            "url = '', "
            "caption = '', "
            "media_url = NULL, "
            "thumbnail_url = NULL, "
            "insights_raw = NULL "
            f"WHERE p.org_id IN ({orgs}) AND ("
            "p.metrics_frozen_at IS NULL "
            "OR p.external_id IS DISTINCT FROM ('frozen-' || p.id::text) "
            "OR p.url <> '' "
            "OR p.caption IS DISTINCT FROM '' "
            "OR p.media_url IS NOT NULL "
            "OR p.thumbnail_url IS NOT NULL "
            "OR p.insights_raw IS NOT NULL)"
        ),
        (
            "UPDATE organizations AS o SET follower_count = NULL, university = '' "
            "FROM users u "
            f"WHERE u.id = o.user_id AND {pred} "
            "AND (o.follower_count IS NOT NULL OR o.university <> '')"
        ),
        (
            "UPDATE drop_applications SET pitch = NULL "
            f"WHERE org_id IN ({orgs}) AND pitch IS NOT NULL"
        ),
        (
            "DELETE FROM post_campaign_suggestions "
            f"WHERE application_id IN ({apps}) OR post_id IN ({posts})"
        ),
        f"DELETE FROM notify_me WHERE org_id IN ({orgs})",
    ]


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


async def freeze_org_campaign_metrics(
    db: AsyncSession,
    *,
    org_id: UUID | None = None,
    now: datetime | None = None,
) -> None:
    """Stamp and strip posts for one org, or every already-erased org.

    Keeps the first ``metrics_frozen_at``. Safe to run twice. Does not delete
    seats, links, or numeric metrics.
    """

    org_ids = await _target_org_ids(db, org_id)
    if not org_ids:
        return
    frozen_at = now or datetime.now(timezone.utc)
    posts = list(await db.scalars(select(SocialPost).where(SocialPost.org_id.in_(org_ids))))
    post_ids = [post.id for post in posts]
    for post in posts:
        if post.metrics_frozen_at is None:
            post.metrics_frozen_at = frozen_at
        post.external_id = frozen_external_id(post.id)
        post.url = ""
        post.caption = ""
        post.media_url = None
        post.thumbnail_url = None
        post.insights_raw = None

    orgs = list(await db.scalars(select(Organization).where(Organization.id.in_(org_ids))))
    for org in orgs:
        org.follower_count = None
        org.university = ""

    await db.execute(
        update(DropApplication).where(DropApplication.org_id.in_(org_ids)).values(pitch=None)
    )
    sug_filters = [
        PostCampaignSuggestion.application_id.in_(
            select(DropApplication.id).where(DropApplication.org_id.in_(org_ids))
        )
    ]
    if post_ids:
        sug_filters.append(PostCampaignSuggestion.post_id.in_(post_ids))
    await db.execute(delete(PostCampaignSuggestion).where(or_(*sug_filters)))
    await db.execute(delete(NotifyMe).where(NotifyMe.org_id.in_(org_ids)))
    await db.flush()
