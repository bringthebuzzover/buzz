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
from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.enums import BrandTrackerStage, PostLinkSource
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


async def _dismiss_pending_for_post(
    db: AsyncSession,
    post_id: uuid.UUID,
    *,
    except_application_id: uuid.UUID | None = None,
) -> None:
    """Dismiss every still-pending suggestion for a post.

    One post belongs to at most one campaign (``UNIQUE(post_id)`` on
    ``post_campaign_links``), so once a post is attributed the scan's other
    candidates can never be accepted — without this they'd sit pending forever
    on the losing campaigns.
    """

    stmt = update(PostCampaignSuggestion).where(
        PostCampaignSuggestion.post_id == post_id,
        PostCampaignSuggestion.confirmed_at.is_(None),
        PostCampaignSuggestion.dismissed_at.is_(None),
    )
    if except_application_id is not None:
        stmt = stmt.where(PostCampaignSuggestion.application_id != except_application_id)
    await db.execute(stmt.values(dismissed_at=_now()))


async def _confirm_own_and_dismiss_siblings(
    db: AsyncSession,
    post_id: uuid.UUID,
    application_id: uuid.UUID,
) -> None:
    """Confirm this campaign's pending suggestion (if any) and dismiss siblings.

    Manual link and accept both attribute the post; the own-campaign row must
    be ``confirmed_at`` (so unlink can re-arm it), not dismissed.
    """

    await db.execute(
        update(PostCampaignSuggestion)
        .where(
            PostCampaignSuggestion.post_id == post_id,
            PostCampaignSuggestion.application_id == application_id,
            PostCampaignSuggestion.confirmed_at.is_(None),
            PostCampaignSuggestion.dismissed_at.is_(None),
        )
        .values(confirmed_at=_now())
    )
    await _dismiss_pending_for_post(db, post_id, except_application_id=application_id)


async def _dismiss_for_error(
    db: AsyncSession,
    suggestion: PostCampaignSuggestion,
    exc: BuzzAPIException,
) -> BuzzAPIException:
    """Retire a suggestion that can never be accepted, then hand back the error.

    ``get_db`` rolls the request back whenever the handler raises, so the
    dismiss has to be committed here or it would be discarded along with the
    failure it describes. Callers do ``raise await _dismiss_for_error(...)``.
    """

    suggestion.dismissed_at = _now()
    await db.commit()
    return exc


async def _reject_if_drop_finished(db: AsyncSession, drop_id: uuid.UUID) -> None:
    """Finished campaigns are FE read-only; enforce the same on the API."""
    drop = await db.get(Drop, drop_id)
    if drop is not None and drop.brand_tracker_stage == BrandTrackerStage.DROP_FINISHED.value:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "This campaign is finished; posts can no longer be linked or unlinked.",
            status_code=400,
        )


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
                DropApplication.drop_id,
            )
            .join(DropApplication, DropApplication.id == PostCampaignLink.application_id)
            .where(PostCampaignLink.post_id.in_(post_ids))
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
    ``POST_ALREADY_LINKED`` (409) when linked to a different campaign. Once the
    link stands, this campaign's pending suggestion is confirmed (so unlink can
    re-arm it) and every other campaign's pending suggestion is dismissed.
    """

    # Only an accepted org links posts to a campaign; an applied-but-not-yet
    # accepted org gets 404 (and so can't create links the brand aggregate —
    # which counts accepted-only — would never see, keeping the two consistent).
    application = await resolve_owned_application(
        db, org_user, application_id, require_accepted=True
    )
    await _reject_if_drop_finished(db, application.drop_id)
    post = await db.get(SocialPost, post_id)
    if post is None or post.org_id != application.org_id:
        raise BuzzAPIException(errors.NOT_FOUND, "Post not found.", status_code=404)

    existing = await db.scalar(select(PostCampaignLink).where(PostCampaignLink.post_id == post_id))
    if existing is not None:
        if existing.application_id == application.id:
            await _confirm_own_and_dismiss_siblings(db, post_id, application.id)
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
    await _confirm_own_and_dismiss_siblings(db, post_id, application.id)
    await db.flush()
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
    await _reject_if_drop_finished(db, application.drop_id)
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
    """Confirm a suggestion + insert the link in one transaction (§7.4.1).

    Every exit leaves the suggestion terminal: confirmed on success, dismissed
    when the post is gone (410) or already spoken for (409). Sibling
    suggestions for the same post are dismissed alongside a successful accept.
    """

    # Same accepted-only rule as manual linking (see link_post).
    application = await resolve_owned_application(
        db, org_user, application_id, require_accepted=True
    )
    await _reject_if_drop_finished(db, application.drop_id)
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
        raise await _dismiss_for_error(
            db,
            suggestion,
            BuzzAPIException(errors.POST_DELETED, "This post no longer exists.", status_code=410),
        )

    existing = await db.scalar(select(PostCampaignLink).where(PostCampaignLink.post_id == post_id))
    if existing is not None:
        if existing.application_id == application.id:
            # Already linked to *this* campaign (e.g. manually linked while the
            # suggestion stayed pending). Reconcile the dangling suggestion and
            # succeed idempotently rather than 409 (mirrors link_post).
            suggestion.confirmed_at = _now()
            await _dismiss_pending_for_post(db, post_id, except_application_id=application.id)
            await db.flush()
            return build_post_response(
                post,
                linked_application_id=application.id,
                linked_drop_id=application.drop_id,
            )
        raise await _dismiss_for_error(
            db,
            suggestion,
            BuzzAPIException(
                errors.POST_ALREADY_LINKED,
                "This post is already linked to another campaign.",
                status_code=409,
            ),
        )

    # Savepoint so losing the UNIQUE(post_id) race burns only the link insert —
    # the session stays usable, which is what lets us dismiss the suggestion.
    try:
        async with db.begin_nested():
            db.add(
                PostCampaignLink(
                    id=uuid.uuid4(),
                    post_id=post_id,
                    application_id=application.id,
                    source=PostLinkSource.AUTO_SUGGESTED.value,
                )
            )
    except IntegrityError:
        # UNIQUE(post_id) — someone linked meanwhile. Same-campaign race →
        # reconcile; other campaign → dismiss and 409.
        winner = await db.scalar(
            select(PostCampaignLink).where(PostCampaignLink.post_id == post_id)
        )
        if winner is not None and winner.application_id == application.id:
            suggestion.confirmed_at = _now()
            await _dismiss_pending_for_post(db, post_id, except_application_id=application.id)
            await db.flush()
            return build_post_response(
                post,
                linked_application_id=application.id,
                linked_drop_id=application.drop_id,
            )
        raise await _dismiss_for_error(
            db,
            suggestion,
            BuzzAPIException(
                errors.POST_ALREADY_LINKED,
                "This post is already linked to another campaign.",
                status_code=409,
            ),
        ) from None

    suggestion.confirmed_at = _now()
    await _dismiss_pending_for_post(db, post_id, except_application_id=application.id)
    await db.flush()

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
