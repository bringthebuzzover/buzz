"""Posts / links / suggestions orchestration (architecture §7.4).

Pure service functions (no FastAPI types). Ownership of every campaign
sub-resource is enforced via ``campaigns.resolve_owned_application`` (404 on
unknown / other-org / denied). The one-post-one-campaign invariant is enforced
by ``UNIQUE(post_id)`` on ``post_campaign_links`` plus a pre-check that returns
``POST_ALREADY_LINKED`` (409).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.enums import PostLinkSource
from app.models.organization import Organization
from app.models.post_link import PostCampaignLink
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.social_post import SocialPost
from app.models.user import User
from app.schemas.posts import (
    CampaignAggregateResponse,
    PostResponse,
    SuggestionResponse,
)
from app.services.campaigns import resolve_owned_application


def _now() -> datetime:
    return datetime.now(timezone.utc)


def build_post_response(
    post: SocialPost,
    *,
    linked_application_id: uuid.UUID | None = None,
    linked_drop_id: uuid.UUID | None = None,
) -> PostResponse:
    """Serialize a ``SocialPost`` (+ optional link indicator) into the wire shape."""

    return PostResponse(
        id=post.id,
        org_id=post.org_id,
        platform=post.platform,
        external_id=post.external_id,
        url=post.url,
        media_url=post.media_url,
        thumbnail_url=post.thumbnail_url,
        caption=post.caption,
        media_type=post.media_type,
        media_product_type=post.media_product_type,
        posted_at=post.posted_at,
        likes=post.likes,
        comments=post.comments,
        reach=post.reach,
        views=post.views,
        saved=post.saved,
        shares=post.shares,
        reposts=post.reposts,
        total_interactions=post.total_interactions,
        profile_visits=post.profile_visits,
        profile_activity=post.profile_activity,
        follows=post.follows,
        ig_reels_avg_watch_time=post.ig_reels_avg_watch_time,
        ig_reels_video_view_total_time=post.ig_reels_video_view_total_time,
        reels_skip_rate=post.reels_skip_rate,
        metrics_updated_at=post.metrics_updated_at,
        created_at=post.created_at,
        linked_application_id=linked_application_id,
        linked_drop_id=linked_drop_id,
    )


async def _require_org_id(db: AsyncSession, org_user: User) -> uuid.UUID:
    org_id = await db.scalar(select(Organization.id).where(Organization.user_id == org_user.id))
    if org_id is None:
        raise BuzzAPIException(
            errors.INTERNAL_ERROR,
            "Active org account is missing its profile.",
            status_code=500,
        )
    return org_id


async def list_org_posts(db: AsyncSession, org_user: User) -> list[PostResponse]:
    """All the caller org's posts, each annotated with its campaign link (if any)."""

    org_id = await _require_org_id(db, org_user)
    posts = list(
        await db.scalars(
            select(SocialPost)
            .where(SocialPost.org_id == org_id)
            .order_by(SocialPost.posted_at.desc(), SocialPost.id.desc())
        )
    )
    if not posts:
        return []

    post_ids = [post.id for post in posts]
    link_rows = (
        await db.execute(
            select(
                PostCampaignLink.post_id,
                PostCampaignLink.application_id,
                PostCampaignLink.drop_id,
            ).where(PostCampaignLink.post_id.in_(post_ids))
        )
    ).all()
    links = {post_id: (app_id, drop_id) for post_id, app_id, drop_id in link_rows}

    out: list[PostResponse] = []
    for post in posts:
        link = links.get(post.id)
        out.append(
            build_post_response(
                post,
                linked_application_id=link[0] if link else None,
                linked_drop_id=link[1] if link else None,
            )
        )
    return out


async def link_post(
    db: AsyncSession,
    org_user: User,
    application_id: uuid.UUID,
    post_id: uuid.UUID,
) -> PostResponse:
    """Manually attribute one of the caller's posts to a campaign (§7.4.2).

    Idempotent when the post is already linked to *this* campaign; raises
    ``POST_ALREADY_LINKED`` (409) when linked to a different campaign.
    """

    application = await resolve_owned_application(db, org_user, application_id)
    post = await db.get(SocialPost, post_id)
    if post is None or post.org_id != application.org_id:
        raise BuzzAPIException(errors.NOT_FOUND, "Post not found.", status_code=404)

    existing = await db.scalar(select(PostCampaignLink).where(PostCampaignLink.post_id == post_id))
    if existing is not None:
        if existing.application_id == application.id:
            return build_post_response(
                post,
                linked_application_id=application.id,
                linked_drop_id=application.drop_id,
            )
        raise BuzzAPIException(
            errors.POST_ALREADY_LINKED,
            "This post is already linked to another campaign.",
            status_code=409,
        )

    db.add(
        PostCampaignLink(
            id=uuid.uuid4(),
            post_id=post_id,
            application_id=application.id,
            drop_id=application.drop_id,
            source=PostLinkSource.ORG_MANUAL.value,
        )
    )
    try:
        await db.flush()
    except IntegrityError as exc:
        # UNIQUE(post_id) — another request linked this post first (§7.4.2 race).
        raise BuzzAPIException(
            errors.POST_ALREADY_LINKED,
            "This post is already linked to another campaign.",
            status_code=409,
        ) from exc
    return build_post_response(
        post,
        linked_application_id=application.id,
        linked_drop_id=application.drop_id,
    )


async def unlink_post(
    db: AsyncSession,
    org_user: User,
    application_id: uuid.UUID,
    post_id: uuid.UUID,
) -> None:
    """Remove a post↔campaign link (idempotent), re-arming any suggestion.

    Only unlinks from *this* campaign. If a previously-confirmed suggestion
    exists for the same (post, application), its ``confirmed_at`` is cleared so
    the next scan can re-suggest it (architecture §7.4.2, recommended path).
    """

    application = await resolve_owned_application(db, org_user, application_id)
    link = await db.scalar(
        select(PostCampaignLink).where(
            PostCampaignLink.post_id == post_id,
            PostCampaignLink.application_id == application.id,
        )
    )
    if link is not None:
        await db.delete(link)
    await db.execute(
        update(PostCampaignSuggestion)
        .where(
            PostCampaignSuggestion.post_id == post_id,
            PostCampaignSuggestion.application_id == application.id,
            PostCampaignSuggestion.confirmed_at.is_not(None),
        )
        .values(confirmed_at=None)
    )
    await db.flush()


async def get_campaign_aggregate(
    db: AsyncSession,
    org_user: User,
    application_id: uuid.UUID,
) -> CampaignAggregateResponse:
    """Per-campaign metric rollup (ports ``computeCampaignAggregate``)."""

    application = await resolve_owned_application(db, org_user, application_id)
    follower_count = (
        await db.scalar(
            select(Organization.follower_count).where(Organization.id == application.org_id)
        )
        or 0
    )

    posts = list(
        await db.scalars(
            select(SocialPost)
            .join(PostCampaignLink, PostCampaignLink.post_id == SocialPost.id)
            .where(PostCampaignLink.application_id == application.id)
        )
    )
    likes = sum(post.likes for post in posts)
    comments = sum(post.comments for post in posts)
    return CampaignAggregateResponse(
        post_count=len(posts),
        likes=likes,
        comments=comments,
        engagement=likes + comments,
        estimated_reach=follower_count,
    )


async def list_suggestions(
    db: AsyncSession,
    org_user: User,
    application_id: uuid.UUID,
) -> list[SuggestionResponse]:
    """Pending (not confirmed/dismissed) suggestions for a campaign (§7.4.1)."""

    application = await resolve_owned_application(db, org_user, application_id)
    rows = (
        await db.execute(
            select(PostCampaignSuggestion, SocialPost)
            .join(SocialPost, SocialPost.id == PostCampaignSuggestion.post_id)
            .where(
                PostCampaignSuggestion.application_id == application.id,
                PostCampaignSuggestion.confirmed_at.is_(None),
                PostCampaignSuggestion.dismissed_at.is_(None),
            )
            .order_by(SocialPost.posted_at.desc(), SocialPost.id.desc())
        )
    ).all()
    return [
        SuggestionResponse(
            post_id=post.id,
            url=post.url,
            thumbnail_url=post.thumbnail_url,
            caption=post.caption,
            posted_at=post.posted_at,
            likes=post.likes,
            comments=post.comments,
            match_reason=suggestion.match_reason,
            match_evidence=suggestion.match_evidence,
        )
        for suggestion, post in rows
    ]


async def accept_suggestion(
    db: AsyncSession,
    org_user: User,
    application_id: uuid.UUID,
    post_id: uuid.UUID,
) -> PostResponse:
    """Confirm a suggestion + insert the link in one transaction (§7.4.1)."""

    application = await resolve_owned_application(db, org_user, application_id)
    suggestion = await db.scalar(
        select(PostCampaignSuggestion).where(
            PostCampaignSuggestion.application_id == application.id,
            PostCampaignSuggestion.post_id == post_id,
            PostCampaignSuggestion.confirmed_at.is_(None),
            PostCampaignSuggestion.dismissed_at.is_(None),
        )
    )
    if suggestion is None:
        raise BuzzAPIException(
            errors.SUGGESTION_NOT_FOUND,
            "No pending suggestion for this post.",
            status_code=404,
        )

    post = await db.get(SocialPost, post_id)
    if post is None:
        # Post was deleted between the sync and this confirmation (§7.4.1).
        raise BuzzAPIException(errors.POST_DELETED, "This post no longer exists.", status_code=410)

    existing = await db.scalar(select(PostCampaignLink).where(PostCampaignLink.post_id == post_id))
    if existing is not None:
        if existing.application_id == application.id:
            # Already linked to *this* campaign (e.g. manually linked while the
            # suggestion stayed pending). Reconcile the dangling suggestion and
            # succeed idempotently rather than 409 (mirrors link_post).
            suggestion.confirmed_at = _now()
            await db.flush()
            return build_post_response(
                post,
                linked_application_id=application.id,
                linked_drop_id=application.drop_id,
            )
        raise BuzzAPIException(
            errors.POST_ALREADY_LINKED,
            "This post is already linked to another campaign.",
            status_code=409,
        )

    db.add(
        PostCampaignLink(
            id=uuid.uuid4(),
            post_id=post_id,
            application_id=application.id,
            drop_id=application.drop_id,
            source=PostLinkSource.AUTO_SUGGESTED.value,
        )
    )
    suggestion.confirmed_at = _now()
    try:
        await db.flush()
    except IntegrityError as exc:
        # UNIQUE(post_id) — linked elsewhere meanwhile (§7.4.1 race).
        raise BuzzAPIException(
            errors.POST_ALREADY_LINKED,
            "This post is already linked to another campaign.",
            status_code=409,
        ) from exc

    return build_post_response(
        post,
        linked_application_id=application.id,
        linked_drop_id=application.drop_id,
    )


async def dismiss_suggestion(
    db: AsyncSession,
    org_user: User,
    application_id: uuid.UUID,
    post_id: uuid.UUID,
) -> None:
    """Reject a pending suggestion so the scan won't resurface it (§7.4.1)."""

    application = await resolve_owned_application(db, org_user, application_id)
    suggestion = await db.scalar(
        select(PostCampaignSuggestion).where(
            PostCampaignSuggestion.application_id == application.id,
            PostCampaignSuggestion.post_id == post_id,
            PostCampaignSuggestion.confirmed_at.is_(None),
            PostCampaignSuggestion.dismissed_at.is_(None),
        )
    )
    if suggestion is None:
        raise BuzzAPIException(
            errors.SUGGESTION_NOT_FOUND,
            "No pending suggestion for this post.",
            status_code=404,
        )
    suggestion.dismissed_at = _now()
    await db.flush()
