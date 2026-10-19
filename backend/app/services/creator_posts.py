"""Creator post library and a metrics walk that does not use org eligibility."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.creator import Creator
from app.models.enums import (
    ApplicationDecision,
    CreatorStatus,
    Platform,
    PostLinkSource,
)
from app.models.post_link import PostCampaignLink
from app.models.social_post import SocialPost
from app.models.user import User
from app.security.token_crypto import TokenDecryptionError, decrypt_token
from app.services.creators import creator_for_user
from app.services.instagram import InstagramClient


def wire_format(media_product_type: str) -> str:
    if media_product_type.upper() == "REELS":
        return "Reel"
    return "Post"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _posted_at(value: str, fallback: datetime) -> datetime:
    if not value:
        return fallback
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        try:
            return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S%z")
        except ValueError:
            return fallback


async def list_creator_posts(db: AsyncSession, user: User) -> list[dict[str, Any]]:
    creator = await creator_for_user(db, user)
    rows = (
        await db.scalars(
            select(SocialPost)
            .where(SocialPost.creator_id == creator.id)
            .order_by(SocialPost.posted_at.desc())
        )
    ).all()
    return [
        {
            "id": str(row.id),
            "caption": row.caption,
            "format": wire_format(row.media_product_type),
            "posted_at": row.posted_at.isoformat(),
        }
        for row in rows
    ]


async def link_creator_post(
    db: AsyncSession, user: User, application_id: uuid.UUID, post_id: uuid.UUID
) -> dict[str, Any]:
    creator = await creator_for_user(db, user)
    application = await db.get(DropApplication, application_id)
    post = await db.get(SocialPost, post_id)
    if application is None or application.creator_id != creator.id:
        raise BuzzAPIException(
            errors.NOT_FOUND, "Application not found.", status_code=404
        )
    if post is None or post.creator_id != creator.id:
        raise BuzzAPIException(
            errors.FORBIDDEN,
            "That post belongs to another creator.",
            status_code=403,
        )
    if application.decision != ApplicationDecision.ACCEPTED.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "You can link a post after this campaign accepts you.",
            status_code=400,
        )
    db.add(
        PostCampaignLink(
            id=uuid.uuid4(),
            post_id=post.id,
            application_id=application.id,
            source=PostLinkSource.CREATOR_MANUAL.value,
        )
    )
    application.content_state = "in_review"
    try:
        await db.flush()
    except IntegrityError as exc:
        raise BuzzAPIException(
            errors.POST_ALREADY_LINKED,
            "That post is already linked to a campaign.",
            status_code=409,
        ) from exc
    return {"application_id": str(application.id), "linked_post_id": str(post.id)}


async def sync_creator_metrics(db: AsyncSession, ig: InstagramClient) -> dict[str, int]:
    """Refresh creator libraries and follower counts. Does not walk org rows."""
    now = _now()
    creators = (
        await db.scalars(
            select(Creator).where(Creator.status == CreatorStatus.ACTIVE.value)
        )
    ).all()
    written = 0
    followers = 0
    for creator in creators:
        user = await db.get(User, creator.user_id)
        if user is None or not user.instagram_access_token:
            continue
        try:
            token = decrypt_token(user.instagram_access_token)
        except TokenDecryptionError:
            continue
        try:
            profile = await ig.fetch_profile(token)
            creator.follower_count = profile.followers_count
            followers += 1
            media = await ig.fetch_user_media(token)
            created_for_creator = 0
            for ref in media:
                fields = await ig.fetch_media(token, ref.id)
                existing = await db.scalar(
                    select(SocialPost).where(
                        SocialPost.creator_id == creator.id,
                        SocialPost.platform == Platform.INSTAGRAM.value,
                        SocialPost.external_id == fields.id,
                    )
                )
                if existing is None:
                    db.add(
                        SocialPost(
                            id=uuid.uuid4(),
                            org_id=None,
                            creator_id=creator.id,
                            platform=Platform.INSTAGRAM.value,
                            external_id=fields.id,
                            url=fields.permalink,
                            caption=fields.caption or "",
                            media_type=fields.media_type,
                            media_product_type=fields.media_product_type,
                            posted_at=_posted_at(fields.timestamp, now),
                            likes=fields.like_count or 0,
                            comments=fields.comments_count or 0,
                        )
                    )
                    written += 1
                    created_for_creator += 1
            creator.post_count = (creator.post_count or 0) + created_for_creator
        except Exception:
            continue
    await db.flush()
    return {"posts_written": written, "followers_refreshed": followers}
