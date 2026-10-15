"""Creator metrics stay off the org walk, and a post links to one campaign."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.jobs.metric_sync import _eligible_orgs
from app.models.application import DropApplication
from app.models.creator import Creator
from app.models.enums import ApplicationDecision, CreatorStatus, PortalRole
from app.models.social_post import SocialPost
from app.models.user import User
from app.security.token_crypto import encrypt_token
from app.services.creator_drops import publish_creator_drop
from app.services.creator_posts import link_creator_post, sync_creator_metrics
from app.services.instagram import MediaRef
from tests.conftest import FakeInstagramClient, make_brand, make_user, persist


async def _active(db_session, email: str, ig_id: str) -> tuple[User, Creator]:
    user = make_user(role=PortalRole.CREATOR, instagram_user_id=ig_id)
    user.edu_email = email
    user.instagram_access_token = encrypt_token("creator-token")
    user.instagram_username = "creatorhandle"
    await persist(db_session, user)
    creator = Creator(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Ada",
        school="Cornell",
        city="Ithaca",
        grad_year="2027",
        niches=["photo"],
        bio="bio",
        claimed_instagram_username="ada.creates",
        tiktok_handle="",
        open_to=["Flat fee"],
        status=CreatorStatus.ACTIVE.value,
    )
    db_session.add(creator)
    await db_session.flush()
    return user, creator


class TestCreatorPosts:
    async def test_sync_and_link(self, db_session, fake_instagram: FakeInstagramClient):
        brand = await make_brand(db_session)
        now = datetime.now(timezone.utc)
        drop = await publish_creator_drop(
            db_session,
            brand_id=brand.id,
            title="Drop",
            description="Digital",
            creator_cap=2,
            creator_gross=300,
            apply_open_at=now - timedelta(days=1),
            apply_close_at=now + timedelta(days=2),
        )
        user, creator = await _active(db_session, "posts@cornell.edu", "ig_posts_1")
        other_user, other = await _active(db_session, "otherposts@cornell.edu", "ig_posts_2")
        fake_instagram.user_id = "ig_posts_1"
        fake_instagram.followers_count = 1200
        fake_instagram.media = [MediaRef(id="media-1", timestamp="2030-01-01T00:00:00+0000")]
        stats = await sync_creator_metrics(db_session, fake_instagram)
        assert stats["posts_written"] >= 1
        await db_session.refresh(creator)
        assert creator.follower_count == 1200
        post = await db_session.scalar(
            select(SocialPost).where(SocialPost.creator_id == creator.id)
        )
        assert post is not None
        assert post.org_id is None
        orgs = await _eligible_orgs(db_session, now)
        assert orgs == []

        application = DropApplication(
            id=uuid.uuid4(),
            drop_id=drop.id,
            creator_id=creator.id,
            decision=ApplicationDecision.APPLIED.value,
            pitch="hi",
        )
        other_app = DropApplication(
            id=uuid.uuid4(),
            drop_id=drop.id,
            creator_id=other.id,
            decision=ApplicationDecision.APPLIED.value,
            pitch="other",
        )
        db_session.add_all([application, other_app])
        await db_session.flush()

        linked = await link_creator_post(db_session, user, application.id, post.id)
        assert linked["linked_post_id"] == str(post.id)
        await db_session.refresh(application)
        assert application.content_state == "in_review"

        empty_user = await persist(db_session, make_user(role=PortalRole.CREATOR))
        empty_user.edu_email = "empty@cornell.edu"
        await db_session.flush()
        db_session.add(
            Creator(
                id=uuid.uuid4(),
                user_id=empty_user.id,
                name="Empty",
                school="Cornell",
                city="Ithaca",
                grad_year="2028",
                niches=["photo"],
                bio="bio",
                claimed_instagram_username="empty",
                tiktok_handle="",
                open_to=[],
                status=CreatorStatus.ACTIVE.value,
            )
        )
        await db_session.flush()
        from app.services.creator_posts import list_creator_posts

        assert await list_creator_posts(db_session, empty_user) == []

        from app.exceptions import BuzzAPIException

        try:
            await link_creator_post(db_session, other_user, other_app.id, post.id)
            raise AssertionError("other creator should not link this post")
        except BuzzAPIException as exc:
            assert exc.status_code == 403

        second_drop = await publish_creator_drop(
            db_session,
            brand_id=brand.id,
            title="Second",
            description="Digital",
            creator_cap=2,
            creator_gross=300,
            apply_open_at=now - timedelta(days=1),
            apply_close_at=now + timedelta(days=2),
        )
        second = DropApplication(
            id=uuid.uuid4(),
            drop_id=second_drop.id,
            creator_id=creator.id,
            decision=ApplicationDecision.APPLIED.value,
            pitch="again",
        )
        db_session.add(second)
        await db_session.flush()
        try:
            await link_creator_post(db_session, user, second.id, post.id)
            raise AssertionError("post should not link twice")
        except BuzzAPIException as exc:
            assert exc.status_code == 409
