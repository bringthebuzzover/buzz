"""Creator finalize does not create shipments or move org capacity."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.enums import (
    ApplicationDecision,
    Platform,
    PostLinkSource,
    SocialMediaProductType,
    SocialMediaType,
)
from app.models.post_link import PostCampaignLink
from app.models.social_post import SocialPost
from app.services.creator_drops import (
    accept_creator_post,
    finalize_creator_roster,
    publish_creator_drop,
)
from tests.conftest import make_brand


def _window(past: bool):
    now = datetime.now(timezone.utc)
    if past:
        return now - timedelta(days=5), now - timedelta(days=1)
    return now - timedelta(days=1), now + timedelta(days=2)


class TestCreatorFinalize:
    async def test_finalize_rules(self, db_session):
        from app.models.creator import Creator
        from app.models.enums import CreatorStatus, PortalRole
        from tests.conftest import make_user, persist

        brand = await make_brand(db_session)
        user = await persist(db_session, make_user(role=PortalRole.CREATOR))
        user.edu_email = "fin@cornell.edu"
        creator = Creator(
            id=uuid.uuid4(),
            user_id=user.id,
            name="Ada",
            school="Cornell",
            city="Ithaca",
            grad_year="2027",
            niches=["photo"],
            bio="bio",
            claimed_instagram_username="ada",
            tiktok_handle="",
            open_to=[],
            status=CreatorStatus.ACTIVE.value,
        )
        db_session.add(creator)
        await db_session.flush()
        open_at, close_at = _window(False)
        live = await publish_creator_drop(
            db_session,
            brand_id=brand.id,
            title="Live",
            description="Digital",
            creator_cap=1,
            creator_gross=400,
            apply_open_at=open_at,
            apply_close_at=close_at,
        )
        application = DropApplication(
            id=uuid.uuid4(),
            drop_id=live.id,
            creator_id=creator.id,
            decision=ApplicationDecision.APPLIED.value,
            pitch="hi",
            content_state="in_review",
        )
        db_session.add(application)
        await db_session.flush()
        with pytest.raises(BuzzAPIException) as early:
            await finalize_creator_roster(db_session, live.id, [application.id])
        assert early.value.status_code == 400

        past_open, past_close = _window(True)
        closed = await publish_creator_drop(
            db_session,
            brand_id=brand.id,
            title="Closed",
            description="Digital",
            creator_cap=1,
            creator_gross=400,
            apply_open_at=past_open,
            apply_close_at=past_close,
        )
        one = DropApplication(
            id=uuid.uuid4(),
            drop_id=closed.id,
            creator_id=creator.id,
            decision=ApplicationDecision.APPLIED.value,
            pitch="one",
            content_state="in_review",
        )
        two = DropApplication(
            id=uuid.uuid4(),
            drop_id=closed.id,
            creator_id=creator.id,
            decision=ApplicationDecision.DENIED.value,
            pitch="two",
        )
        db_session.add_all([one, two])
        await db_session.flush()
        with pytest.raises(BuzzAPIException) as over:
            await finalize_creator_roster(db_session, closed.id, [one.id, two.id])
        assert over.value.status_code == 400

        result = await finalize_creator_roster(db_session, closed.id, [one.id])
        assert result["capacity_total"] == 1
        await db_session.refresh(closed)
        assert closed.brand_tracker_stage == "request_received"
        await db_session.refresh(one)
        assert one.decision == ApplicationDecision.ACCEPTED.value

        post = SocialPost(
            id=uuid.uuid4(),
            creator_id=creator.id,
            platform=Platform.INSTAGRAM.value,
            external_id="ext-fin",
            url="https://instagram.com/p/ext-fin",
            caption="cap",
            media_type=SocialMediaType.IMAGE.value,
            media_product_type=SocialMediaProductType.FEED.value,
            posted_at=datetime.now(timezone.utc),
        )
        db_session.add(post)
        await db_session.flush()
        db_session.add(
            PostCampaignLink(
                id=uuid.uuid4(),
                post_id=post.id,
                application_id=one.id,
                source=PostLinkSource.CREATOR_MANUAL.value,
            )
        )
        await db_session.flush()
        from app.services.creator_drops import creator_earnings, record_creator_payout

        with pytest.raises(BuzzAPIException) as unpaid:
            await record_creator_payout(db_session, one.id)
        assert unpaid.value.status_code == 400

        accepted = await accept_creator_post(db_session, one.id)
        assert accepted["content"] == "accepted"
        first = await record_creator_payout(db_session, one.id)
        second = await record_creator_payout(db_session, one.id)
        assert first["payout"] == "recorded" and second["payout"] == "recorded"

        other = await persist(db_session, make_user(role=PortalRole.CREATOR))
        other.edu_email = "zero@cornell.edu"
        db_session.add(
            Creator(
                id=uuid.uuid4(),
                user_id=other.id,
                name="Zero",
                school="Cornell",
                city="Ithaca",
                grad_year="2028",
                niches=[],
                bio="bio",
                claimed_instagram_username="zero",
                tiktok_handle="",
                open_to=[],
                status=CreatorStatus.ACTIVE.value,
            )
        )
        await db_session.flush()
        pending_drop = await publish_creator_drop(
            db_session,
            brand_id=brand.id,
            title="Pending pay",
            description="Digital",
            creator_cap=1,
            creator_gross=300,
            apply_open_at=past_open,
            apply_close_at=past_close,
        )
        db_session.add(
            DropApplication(
                id=uuid.uuid4(),
                drop_id=pending_drop.id,
                creator_id=creator.id,
                decision=ApplicationDecision.ACCEPTED.value,
                pitch="owed",
                content_state="accepted",
                payout_state="not_recorded",
            )
        )
        await db_session.flush()
        mine = await creator_earnings(db_session, user)
        assert mine == {"paid": 400, "pending": 300, "year_to_date": 700}
        assert await creator_earnings(db_session, other) == {
            "paid": 0,
            "pending": 0,
            "year_to_date": 0,
        }
