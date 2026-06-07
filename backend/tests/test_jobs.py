"""Tests for the Stage 8 background jobs (architecture.md §10)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks
from sqlalchemy import select

from app.exceptions import BuzzAPIException
from app.jobs.autolink_scan import scan_autolink
from app.jobs.drop_autoclose import auto_close_drops
from app.jobs.metric_sync import sync_metrics
from app.jobs.token_cleanup import cleanup_tokens
from app.jobs.token_refresh import refresh_due_tokens
from app.models.brand_invite_token import BrandInviteToken
from app.models.enums import (
    ApplicationDecision,
    BrandTrackerStage,
    SocialMediaProductType,
)
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.social_post import SocialPost
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.security.token_crypto import encrypt_token
from app.services.instagram import MediaFields, MediaRef
from app.services.instagram_token import (
    days_until_expiry,
    maybe_refresh_on_login,
    refresh_instagram_token,
)
from tests.conftest import (
    FakeInstagramClient,
    make_application,
    make_brand,
    make_drop,
    make_org,
    make_post_link,
    make_social_post,
    make_user,
    persist,
)


class _FailingMediaClient(FakeInstagramClient):
    """Fake whose per-media fetch always fails (drives error-handling paths)."""

    async def fetch_media(self, long_token, media_id):  # type: ignore[override]
        raise RuntimeError("instagram media fetch failed")


class _FailingRefreshClient(FakeInstagramClient):
    """Fake whose token refresh always fails."""

    async def refresh_long_lived(self, long_token):  # type: ignore[override]
        raise RuntimeError("refresh failed")


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- 10.2 Drop auto-close ----------------------------------------------------


async def test_autoclose_advances_closed_request_received(db_session) -> None:
    brand = await make_brand(db_session)
    drop = await make_drop(
        db_session, brand, apply_close_at=_now() - timedelta(hours=1)
    )  # request_received, window passed
    result = await auto_close_drops(db_session)

    assert result["advanced"] == 1
    await db_session.refresh(drop)
    assert drop.brand_tracker_stage == BrandTrackerStage.FINALIZING_AGREEMENTS.value


async def test_autoclose_skips_manual_reopen_and_open_window(db_session) -> None:
    brand = await make_brand(db_session)
    reopened = await make_drop(
        db_session, brand, apply_close_at=_now() - timedelta(hours=1), manual_reopen=True
    )
    still_open = await make_drop(db_session, brand, apply_close_at=_now() + timedelta(days=3))
    already = await make_drop(
        db_session,
        brand,
        apply_close_at=_now() - timedelta(hours=1),
        stage=BrandTrackerStage.AWAITING_PRODUCTS,
    )

    result = await auto_close_drops(db_session)
    assert result["advanced"] == 0
    for d in (reopened, still_open, already):
        await db_session.refresh(d)
    assert reopened.brand_tracker_stage == BrandTrackerStage.REQUEST_RECEIVED.value
    assert still_open.brand_tracker_stage == BrandTrackerStage.REQUEST_RECEIVED.value
    assert already.brand_tracker_stage == BrandTrackerStage.AWAITING_PRODUCTS.value


# --- 10.3 Token cleanup ------------------------------------------------------


async def test_cleanup_sweeps_old_used_and_expired_tokens(db_session) -> None:
    org_user = await persist(db_session, make_user(instagram_user_id="ig_cleanup"))
    old = _now() - timedelta(days=30)

    # used long ago -> swept
    db_session.add(
        EmailVerificationToken(
            id=uuid.uuid4(),
            user_id=org_user.id,
            token="t-used",
            email="a@x.edu",
            expires_at=_now() + timedelta(days=1),
            used_at=old,
        )
    )
    # expired long ago -> swept
    db_session.add(
        EmailVerificationToken(
            id=uuid.uuid4(),
            user_id=org_user.id,
            token="t-exp",
            email="b@x.edu",
            expires_at=old,
        )
    )
    # fresh + unused -> kept
    db_session.add(
        EmailVerificationToken(
            id=uuid.uuid4(),
            user_id=org_user.id,
            token="t-fresh",
            email="c@x.edu",
            expires_at=_now() + timedelta(days=1),
        )
    )
    await db_session.flush()

    result = await cleanup_tokens(db_session)
    assert result["verification_tokens_deleted"] == 2
    remaining = list(await db_session.scalars(select(EmailVerificationToken.token)))
    assert remaining == ["t-fresh"]


async def test_cleanup_respects_grace_window(db_session) -> None:
    org_user = await persist(db_session, make_user(instagram_user_id="ig_grace"))
    # used yesterday -> within the 7-day grace -> kept
    db_session.add(
        EmailVerificationToken(
            id=uuid.uuid4(),
            user_id=org_user.id,
            token="t-recent",
            email="d@x.edu",
            expires_at=_now() + timedelta(days=1),
            used_at=_now() - timedelta(days=1),
        )
    )
    await db_session.flush()
    result = await cleanup_tokens(db_session)
    assert result["verification_tokens_deleted"] == 0


# --- 10.4 Auto-link scan -----------------------------------------------------


async def _accepted_live_ctx(db_session, *, handle="nike", hashtag=None):
    org_user = await persist(db_session, make_user(instagram_user_id="ig_al"))
    org = await make_org(db_session, org_user)
    brand = await make_brand(db_session)
    brand.instagram_handle = handle
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_ACTIVE)
    drop.campaign_hashtag = hashtag
    await db_session.flush()
    app = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
    return org, brand, drop, app


async def test_autolink_creates_suggestion_for_handle_mention(db_session) -> None:
    org, _, drop, app = await _accepted_live_ctx(db_session)
    await make_social_post(db_session, org, caption="so hyped for the @nike drop today")

    result = await scan_autolink(db_session)
    assert result["suggestions_created"] == 1
    sug = await db_session.scalar(select(PostCampaignSuggestion))
    assert sug.match_reason == "brand_handle_caption"
    assert "@nike" in sug.match_evidence


async def test_autolink_skips_email_story_and_is_idempotent(db_session) -> None:
    org, _, drop, app = await _accepted_live_ctx(db_session)
    await make_social_post(db_session, org, caption="email me at x@nike for info")  # not a mention
    await make_social_post(
        db_session, org, caption="@nike story!", media_product_type=SocialMediaProductType.STORY
    )
    await make_social_post(db_session, org, caption="love @nike collab")  # the real match

    first = await scan_autolink(db_session)
    assert first["suggestions_created"] == 1
    # idempotent re-run
    second = await scan_autolink(db_session)
    assert second["suggestions_created"] == 0


async def test_autolink_hashtag_only_match(db_session) -> None:
    org, _, drop, app = await _accepted_live_ctx(db_session, handle="nike", hashtag="nikebuzz")
    await make_social_post(db_session, org, caption="repping #NikeBuzz this week")
    result = await scan_autolink(db_session)
    assert result["suggestions_created"] == 1
    sug = await db_session.scalar(select(PostCampaignSuggestion))
    assert sug.match_reason == "campaign_hashtag"


# --- 10.5 Token refresh ------------------------------------------------------


def _org_with_token(days_to_expiry: int) -> User:
    user = make_user(instagram_user_id="ig_tok")
    user.instagram_access_token = encrypt_token("old-long-lived")
    user.instagram_token_expires_at = _now() + timedelta(days=days_to_expiry)
    return user


async def test_token_refresh_cron_refreshes_due(db_session) -> None:
    user = await persist(db_session, _org_with_token(days_to_expiry=7))
    fake = FakeInstagramClient()
    result = await refresh_due_tokens(db_session, fake)
    assert result["refreshed"] == 1
    await db_session.refresh(user)
    # token rotated + expiry pushed ~60d out
    assert user.instagram_token_refreshed_at is not None
    assert user.instagram_token_expires_at > _now() + timedelta(days=30)


async def test_token_refresh_cron_skips_far_expiry(db_session) -> None:
    await persist(db_session, _org_with_token(days_to_expiry=40))
    result = await refresh_due_tokens(db_session, FakeInstagramClient())
    assert result["candidates"] == 0


def test_on_login_enqueues_near_expiry() -> None:
    user = _org_with_token(days_to_expiry=10)
    bg = BackgroundTasks()
    maybe_refresh_on_login(user, bg, FakeInstagramClient())
    assert len(bg.tasks) == 1


def test_on_login_raises_when_expired() -> None:
    user = _org_with_token(days_to_expiry=-1)
    try:
        maybe_refresh_on_login(user, BackgroundTasks(), FakeInstagramClient())
    except BuzzAPIException as exc:
        assert exc.code == "INSTAGRAM_TOKEN_EXPIRED"
    else:
        raise AssertionError("expected INSTAGRAM_TOKEN_EXPIRED")


def test_on_login_noop_for_brand() -> None:
    brand_user = make_user()
    brand_user.portal_role = "brand"
    assert days_until_expiry(brand_user) is None
    bg = BackgroundTasks()
    maybe_refresh_on_login(brand_user, bg, FakeInstagramClient())
    assert len(bg.tasks) == 0


# --- 10.1 Metric sync --------------------------------------------------------


async def test_metric_sync_discovers_and_refreshes(db_session) -> None:
    org_user = await persist(db_session, make_user(instagram_user_id="ig_sync"))
    org_user.instagram_access_token = encrypt_token("long-lived")
    org_user.instagram_token_expires_at = _now() + timedelta(days=50)
    org = await make_org(db_session, org_user)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_ACTIVE)
    await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
    await db_session.flush()

    fake = FakeInstagramClient()
    fake.media = [MediaRef(id="m1", timestamp="2030-01-01T00:00:00+0000")]
    fake.media_fields = {
        "m1": MediaFields(
            id="m1",
            caption="new post",
            media_type="IMAGE",
            media_product_type="FEED",
            permalink="https://instagram.com/p/m1",
            thumbnail_url=None,
            media_url=None,
            timestamp="2030-01-01T00:00:00+0000",
            like_count=42,
            comments_count=7,
        )
    }
    fake.insights = {"reach": 500, "saved": 9}

    result = await sync_metrics(db_session, fake)
    assert result["posts_discovered"] == 1
    assert result["posts_refreshed"] >= 1

    post = await db_session.scalar(select(SocialPost).where(SocialPost.external_id == "m1"))
    assert post is not None
    assert post.likes == 42
    assert post.reach == 500
    assert post.metrics_updated_at is not None


async def test_metric_sync_skips_orgs_without_live_campaign(db_session) -> None:
    org_user = await persist(db_session, make_user(instagram_user_id="ig_nolive"))
    org_user.instagram_access_token = encrypt_token("long-lived")
    org_user.instagram_token_expires_at = _now() + timedelta(days=50)
    org = await make_org(db_session, org_user)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.REQUEST_RECEIVED)
    await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)
    await db_session.flush()

    result = await sync_metrics(db_session, FakeInstagramClient())
    assert result["orgs"] == 0


# ===========================================================================
# Edge cases
# ===========================================================================


def _raw_post(org_id, *, caption, posted_at, product_type="FEED", likes=10, ext=None):
    """Build (not persist) a SocialPost with an explicit posted_at / product type."""
    return SocialPost(
        id=uuid.uuid4(),
        org_id=org_id,
        platform="instagram",
        external_id=ext or uuid.uuid4().hex[:12],
        url="https://instagram.test/p/x",
        caption=caption,
        media_type="IMAGE",
        media_product_type=product_type,
        posted_at=posted_at,
        likes=likes,
        comments=0,
    )


async def _eligible_sync_org(db, *, suffix, days=50):
    user = await persist(db, make_user(instagram_user_id=f"ig_{suffix}"))
    user.instagram_access_token = encrypt_token("long-lived")
    user.instagram_token_expires_at = _now() + timedelta(days=days)
    org = await make_org(db, user)
    brand = await make_brand(db)
    drop = await make_drop(db, brand, stage=BrandTrackerStage.DROP_ACTIVE)
    await make_application(db, drop, org, decision=ApplicationDecision.ACCEPTED)
    await db.flush()
    return user, org


# --- autolink edge cases ---


async def test_autolink_both_reason(db_session) -> None:
    org, _, _, _ = await _accepted_live_ctx(db_session, handle="nike", hashtag="nikebuzz")
    await make_social_post(db_session, org, caption="@nike x #NikeBuzz")
    await scan_autolink(db_session)
    sug = await db_session.scalar(select(PostCampaignSuggestion))
    assert sug.match_reason == "both"


async def test_autolink_skips_already_linked_post(db_session) -> None:
    org, _, _, app = await _accepted_live_ctx(db_session)
    post = await make_social_post(db_session, org, caption="love @nike")
    await make_post_link(db_session, post, app)  # already linked → skip
    result = await scan_autolink(db_session)
    assert result["suggestions_created"] == 0


async def test_autolink_ignores_non_accepted_application(db_session) -> None:
    org_user = await persist(db_session, make_user(instagram_user_id="ig_applied"))
    org = await make_org(db_session, org_user)
    brand = await make_brand(db_session)
    brand.instagram_handle = "nike"
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_ACTIVE)
    await db_session.flush()
    await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)
    await make_social_post(db_session, org, caption="love @nike")
    result = await scan_autolink(db_session)
    assert result["applications_scanned"] == 0
    assert result["suggestions_created"] == 0


async def test_autolink_ignores_non_live_stage(db_session) -> None:
    org_user = await persist(db_session, make_user(instagram_user_id="ig_notlive"))
    org = await make_org(db_session, org_user)
    brand = await make_brand(db_session)
    brand.instagram_handle = "nike"
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.FINALIZING_AGREEMENTS)
    await db_session.flush()
    await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
    await make_social_post(db_session, org, caption="love @nike")
    result = await scan_autolink(db_session)
    assert result["applications_scanned"] == 0


async def test_autolink_skips_brand_without_handle(db_session) -> None:
    org, brand, _, _ = await _accepted_live_ctx(db_session, handle="nike")
    brand.instagram_handle = None
    await db_session.flush()
    await make_social_post(db_session, org, caption="love @nike")
    result = await scan_autolink(db_session)
    assert result["applications_scanned"] == 0


async def test_autolink_case_insensitive_but_boundary_aware(db_session) -> None:
    org, _, _, _ = await _accepted_live_ctx(db_session, handle="nike")
    await make_social_post(db_session, org, caption="HYPE @NIKE today")  # case-insensitive match
    await make_social_post(db_session, org, caption="@nikeshoes are great")  # boundary → no match
    result = await scan_autolink(db_session)
    assert result["suggestions_created"] == 1


async def test_autolink_skips_out_of_window_and_ad(db_session) -> None:
    org, _, drop, _ = await _accepted_live_ctx(db_session)
    # 40 days before the window opens → out of range
    db_session.add(_raw_post(org.id, caption="early @nike", posted_at=_now() - timedelta(days=40)))
    # AD product type → not suggestable
    db_session.add(
        _raw_post(
            org.id, caption="@nike ad", posted_at=_now() - timedelta(hours=2), product_type="AD"
        )
    )
    await db_session.flush()
    result = await scan_autolink(db_session)
    assert result["suggestions_created"] == 0


# --- token cleanup edge cases ---


async def test_cleanup_sweeps_brand_invite_tokens(db_session) -> None:
    brand = await make_brand(db_session)
    user = await db_session.get(User, brand.user_id)
    old = _now() - timedelta(days=30)
    db_session.add(
        BrandInviteToken(
            id=uuid.uuid4(),
            user_id=user.id,
            brand_id=brand.id,
            token="bi-used",
            email="b@x.com",
            expires_at=_now() + timedelta(days=1),
            used_at=old,
        )
    )
    db_session.add(
        BrandInviteToken(
            id=uuid.uuid4(),
            user_id=user.id,
            brand_id=brand.id,
            token="bi-fresh",
            email="c@x.com",
            expires_at=_now() + timedelta(days=3),
        )
    )
    await db_session.flush()
    result = await cleanup_tokens(db_session)
    assert result["brand_invite_tokens_deleted"] == 1
    remaining = list(await db_session.scalars(select(BrandInviteToken.token)))
    assert remaining == ["bi-fresh"]


# --- token refresh edge cases ---


async def test_token_refresh_cron_counts_failures_and_keeps_token(db_session) -> None:
    user = await persist(db_session, _org_with_token(days_to_expiry=7))
    original = user.instagram_access_token
    result = await refresh_due_tokens(db_session, _FailingRefreshClient())
    assert result == {"candidates": 1, "refreshed": 0, "failed": 1}
    await db_session.refresh(user)
    assert user.instagram_access_token == original  # old token preserved


async def test_token_refresh_cron_skips_imminent_expiry(db_session) -> None:
    # expires in 12h -> inside the "don't bother" minimum -> not a candidate
    user = make_user(instagram_user_id="ig_soon")
    user.instagram_access_token = encrypt_token("x")
    user.instagram_token_expires_at = _now() + timedelta(hours=12)
    await persist(db_session, user)
    result = await refresh_due_tokens(db_session, FakeInstagramClient())
    assert result["candidates"] == 0


def test_on_login_noop_for_fresh_token() -> None:
    user = _org_with_token(days_to_expiry=45)
    bg = BackgroundTasks()
    maybe_refresh_on_login(user, bg, FakeInstagramClient())
    assert len(bg.tasks) == 0


def test_on_login_noop_without_token() -> None:
    user = make_user(instagram_user_id="ig_notoken")  # org, no IG token
    assert days_until_expiry(user) is None
    bg = BackgroundTasks()
    maybe_refresh_on_login(user, bg, FakeInstagramClient())
    assert len(bg.tasks) == 0


async def test_refresh_instagram_token_missing_user_returns_false() -> None:
    from app.deps.db import engine

    await engine.dispose()  # rebind the module pool to this test's event loop
    assert await refresh_instagram_token(uuid.uuid4()) is False


async def test_refresh_instagram_token_rotates(monkeypatch) -> None:
    import app.services.instagram_token as itok
    from app.deps.db import async_session_factory, engine

    await engine.dispose()
    uid = uuid.uuid4()
    async with async_session_factory() as s:
        s.add(
            User(
                id=uid,
                portal_role="org",
                status="active",
                instagram_user_id=f"ig_rot_{uid.hex[:8]}",
                instagram_access_token=encrypt_token("old"),
                instagram_token_expires_at=_now() + timedelta(days=10),
            )
        )
        await s.commit()

    monkeypatch.setattr(itok, "get_instagram_client", lambda: FakeInstagramClient())
    try:
        assert await refresh_instagram_token(uid) is True
        async with async_session_factory() as s:
            u = await s.get(User, uid)
            assert u.instagram_token_refreshed_at is not None
            assert u.instagram_token_expires_at > _now() + timedelta(days=30)
    finally:
        async with async_session_factory() as s:
            u = await s.get(User, uid)
            if u is not None:
                await s.delete(u)
                await s.commit()


# --- metric sync edge cases ---


async def test_metric_sync_skips_expired_token_org(db_session) -> None:
    user, org = await _eligible_sync_org(db_session, suffix="expired", days=50)
    user.instagram_token_expires_at = _now() - timedelta(days=1)  # expired
    await db_session.flush()
    fake = FakeInstagramClient()
    fake.media = [MediaRef(id="mx", timestamp="2030-01-01T00:00:00+0000")]
    result = await sync_metrics(db_session, fake)
    assert result["posts_discovered"] == 0
    assert result["posts_refreshed"] == 0


async def test_metric_sync_does_not_refresh_story(db_session) -> None:
    user, org = await _eligible_sync_org(db_session, suffix="story")
    story = _raw_post(
        org.id,
        caption="story",
        posted_at=_now() - timedelta(hours=2),
        product_type="STORY",
        likes=99,
    )
    db_session.add(story)
    await db_session.flush()
    fake = FakeInstagramClient()  # no media to discover
    await sync_metrics(db_session, fake)
    await db_session.refresh(story)
    assert story.likes == 99  # untouched (default fake fetch would set 10)
    assert story.metrics_updated_at is None


async def test_metric_sync_applies_reel_insights(db_session) -> None:
    user, org = await _eligible_sync_org(db_session, suffix="reel")
    reel = _raw_post(
        org.id, caption="reel", posted_at=_now() - timedelta(hours=2), product_type="REELS"
    )
    db_session.add(reel)
    await db_session.flush()
    fake = FakeInstagramClient()
    fake.insights = {"reach": 300, "ig_reels_avg_watch_time": 1200, "reels_skip_rate": 1}
    await sync_metrics(db_session, fake)
    await db_session.refresh(reel)
    assert reel.reach == 300
    assert reel.ig_reels_avg_watch_time == 1200
    assert reel.reels_skip_rate == 1.0


async def test_metric_sync_counts_per_post_failure(db_session) -> None:
    user, org = await _eligible_sync_org(db_session, suffix="fail")
    post = await make_social_post(db_session, org, caption="x")
    pre = post.metrics_updated_at
    result = await sync_metrics(db_session, _FailingMediaClient())
    assert result["failures"] >= 1
    await db_session.refresh(post)
    assert post.metrics_updated_at == pre  # not updated on failure


async def test_metric_sync_discovery_skips_old_and_existing(db_session) -> None:
    user, org = await _eligible_sync_org(db_session, suffix="disc")
    # An existing post with external_id "dup" should not be re-inserted.
    db_session.add(
        _raw_post(org.id, caption="existing", posted_at=_now() - timedelta(days=2), ext="dup")
    )
    await db_session.flush()
    fake = FakeInstagramClient()
    fake.media = [
        MediaRef(id="dup", timestamp="2030-01-01T00:00:00+0000"),  # already exists
        MediaRef(id="old", timestamp="2000-01-01T00:00:00+0000"),  # > 30 days → skip
    ]
    result = await sync_metrics(db_session, fake)
    assert result["posts_discovered"] == 0
