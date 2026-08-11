"""Tests for the Stage 8 background jobs (architecture.md §10)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import BackgroundTasks
from sqlalchemy import select

from app.exceptions import BuzzAPIException
from app.jobs import notify_reminders
from app.jobs.autolink_scan import scan_autolink
from app.jobs.drop_autoclose import auto_close_drops
from app.jobs.metric_sync import sync_metrics
from app.jobs.notify_reminders import send_due_reminders
from app.jobs.token_cleanup import cleanup_tokens
from app.jobs.token_refresh import refresh_due_tokens
from app.models.brand_invite_token import BrandInviteToken
from app.models.enums import (
    ApplicationDecision,
    BrandTrackerStage,
    SocialMediaProductType,
)
from app.models.organization import Organization
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.social_post import SocialPost
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.security.one_shot_tokens import hash_token
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
    make_notify,
    make_org,
    make_post_link,
    make_social_post,
    make_suggestion,
    make_user,
    persist,
)


class _FailingMediaClient(FakeInstagramClient):
    """Fake whose per-media fetch always fails (drives error-handling paths)."""

    async def fetch_media(self, long_token, media_id):  # type: ignore[override]
        raise RuntimeError("instagram media fetch failed")


class _FailingInsightsClient(FakeInstagramClient):
    """Basics succeed; insights always fail."""

    async def fetch_media_insights(self, long_token, media_id, *, is_reel=False):  # type: ignore[override]
        raise RuntimeError("instagram insights fetch failed")


class _FailingMediaListClient(FakeInstagramClient):
    async def fetch_user_media(self, long_token, *, limit=50, max_pages=10):  # type: ignore[override]
        raise RuntimeError("instagram media list failed")


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
            token_hash=hash_token("t-used"),
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
            token_hash=hash_token("t-exp"),
            email="b@x.edu",
            expires_at=old,
        )
    )
    # fresh + unused -> kept
    db_session.add(
        EmailVerificationToken(
            id=uuid.uuid4(),
            user_id=org_user.id,
            token_hash=hash_token("t-fresh"),
            email="c@x.edu",
            expires_at=_now() + timedelta(days=1),
        )
    )
    await db_session.flush()

    result = await cleanup_tokens(db_session)
    assert result["verification_tokens_deleted"] == 2
    remaining = list(await db_session.scalars(select(EmailVerificationToken.token_hash)))
    assert remaining == [hash_token("t-fresh")]


async def test_cleanup_respects_grace_window(db_session) -> None:
    org_user = await persist(db_session, make_user(instagram_user_id="ig_grace"))
    # used yesterday -> within the 7-day grace -> kept
    db_session.add(
        EmailVerificationToken(
            id=uuid.uuid4(),
            user_id=org_user.id,
            token_hash=hash_token("t-recent"),
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


async def test_autolink_heals_suggestion_for_linked_post(db_session) -> None:
    """A pending suggestion on an already-attributed post can only ever 409."""

    org, _, drop, app = await _accepted_live_ctx(db_session)
    other_drop = await make_drop(db_session, await make_brand(db_session), title="Other")
    other_app = await make_application(
        db_session, other_drop, org, decision=ApplicationDecision.ACCEPTED
    )
    post = await make_social_post(db_session, org, caption="love @nike")
    stale = await make_suggestion(db_session, post, other_app)
    await make_post_link(db_session, post, app)

    result = await scan_autolink(db_session)
    assert result["suggestions_healed"] == 1
    await db_session.refresh(stale)
    assert stale.dismissed_at is not None


async def test_autolink_does_not_heal_same_campaign_pending(db_session) -> None:
    """Same-campaign pending + link is accept's reconcile path, not a 409."""

    org, _, drop, app = await _accepted_live_ctx(db_session)
    post = await make_social_post(db_session, org, caption="love @nike")
    pending = await make_suggestion(db_session, post, app)
    await make_post_link(db_session, post, app)

    result = await scan_autolink(db_session)
    assert result["suggestions_healed"] == 0
    await db_session.refresh(pending)
    assert pending.dismissed_at is None
    assert pending.confirmed_at is None


async def test_autolink_leaves_live_suggestion_pending(db_session) -> None:
    org, _, drop, app = await _accepted_live_ctx(db_session)
    await make_social_post(db_session, org, caption="love @nike")

    result = await scan_autolink(db_session)
    assert result["suggestions_created"] == 1
    assert result["suggestions_healed"] == 0


# --- 10.6 Notify Me reminders ------------------------------------------------


async def _never_called(to_email, **kwargs):
    raise AssertionError(f"reminder should not have been sent to {to_email}")


async def _notify_ctx(db_session, *, reminder_minutes=15, opens_in=timedelta(minutes=10)):
    """An org subscribed to a drop that opens ``opens_in`` from now."""

    now = _now()
    user = await persist(db_session, make_user(instagram_user_id=f"ig_n_{uuid.uuid4().hex[:8]}"))
    user.edu_email = f"{uuid.uuid4().hex[:10]}@school.edu"
    org = await make_org(db_session, user)
    brand = await make_brand(db_session)
    drop = await make_drop(
        db_session,
        brand,
        apply_open_at=now + opens_in,
        apply_close_at=now + opens_in + timedelta(days=7),
    )
    notify = await make_notify(db_session, org, drop, reminder_minutes=reminder_minutes)
    return user, org, drop, notify


async def test_notify_reminder_sent_when_due(db_session, monkeypatch) -> None:
    sent: list[tuple[str, str]] = []

    async def _capture(to_email, *, org_name="", drop_title="", brand_name=""):
        sent.append((to_email, drop_title))
        return True

    monkeypatch.setattr(notify_reminders, "send_drop_opening_reminder_email", _capture)

    # Opens in 10 minutes with a 15-minute lead time → already due.
    user, _, drop, notify = await _notify_ctx(db_session, reminder_minutes=15)

    result = await send_due_reminders(db_session)
    assert result == {"reminders_sent": 1, "reminders_skipped": 0}
    assert sent == [(user.edu_email, drop.title)]
    assert notify.sent_at is not None


async def test_notify_reminder_not_stamped_when_send_fails(db_session, monkeypatch) -> None:
    async def _fail(to_email, **kwargs):
        return False

    monkeypatch.setattr(notify_reminders, "send_drop_opening_reminder_email", _fail)
    _, _, _, notify = await _notify_ctx(db_session, reminder_minutes=15)

    result = await send_due_reminders(db_session)
    assert result == {"reminders_sent": 0, "reminders_skipped": 0}
    assert notify.sent_at is None

    # Still eligible on the next run once the provider recovers.
    async def _ok(to_email, **kwargs):
        return True

    monkeypatch.setattr(notify_reminders, "send_drop_opening_reminder_email", _ok)
    result2 = await send_due_reminders(db_session)
    assert result2["reminders_sent"] == 1
    assert notify.sent_at is not None


async def test_notify_reminder_not_yet_due(db_session, monkeypatch) -> None:
    monkeypatch.setattr(notify_reminders, "send_drop_opening_reminder_email", _never_called)

    # Opens in 2 hours with a 15-minute lead time → not due yet.
    _, _, _, notify = await _notify_ctx(
        db_session, reminder_minutes=15, opens_in=timedelta(hours=2)
    )

    result = await send_due_reminders(db_session)
    assert result["reminders_sent"] == 0
    assert notify.sent_at is None


async def test_notify_reminder_is_idempotent(db_session, monkeypatch) -> None:
    calls = []

    async def _count(to_email, **kwargs):
        calls.append(to_email)
        return True

    monkeypatch.setattr(notify_reminders, "send_drop_opening_reminder_email", _count)
    await _notify_ctx(db_session)

    first = await send_due_reminders(db_session)
    second = await send_due_reminders(db_session)
    assert first["reminders_sent"] == 1
    assert second["reminders_sent"] == 0
    assert len(calls) == 1


async def test_notify_reminder_skips_closed_window(db_session, monkeypatch) -> None:
    monkeypatch.setattr(notify_reminders, "send_drop_opening_reminder_email", _never_called)

    # A drop whose window opened and closed before anyone got reminded: mailing
    # "apply now" would be worse than staying quiet.
    now = _now()
    user = await persist(db_session, make_user(instagram_user_id="ig_n_closed"))
    user.edu_email = "closed@school.edu"
    org = await make_org(db_session, user)
    drop = await make_drop(
        db_session,
        await make_brand(db_session),
        apply_open_at=now - timedelta(days=9),
        apply_close_at=now - timedelta(days=1),
    )
    notify = await make_notify(db_session, org, drop)

    result = await send_due_reminders(db_session)
    assert result["reminders_sent"] == 0
    assert notify.sent_at is None  # stays visible on the admin health page


async def test_notify_reminder_skips_org_without_edu_email(db_session, monkeypatch) -> None:
    monkeypatch.setattr(notify_reminders, "send_drop_opening_reminder_email", _never_called)

    _, _, _, notify = await _notify_ctx(db_session)
    (await db_session.get(Organization, notify.org_id))  # keep the row loaded
    user = await db_session.scalar(
        select(User)
        .join(Organization, Organization.user_id == User.id)
        .where(Organization.id == notify.org_id)
    )
    user.edu_email = None
    await db_session.flush()

    result = await send_due_reminders(db_session)
    assert result == {"reminders_sent": 0, "reminders_skipped": 1}
    assert notify.sent_at is None


async def test_notify_reminder_ignores_disabled_rows(db_session, monkeypatch) -> None:
    monkeypatch.setattr(notify_reminders, "send_drop_opening_reminder_email", _never_called)

    _, _, _, notify = await _notify_ctx(db_session)
    notify.enabled = False
    await db_session.flush()

    result = await send_due_reminders(db_session)
    assert result["reminders_sent"] == 0


async def test_notify_reminder_skips_finished_drop(db_session, monkeypatch) -> None:
    monkeypatch.setattr(notify_reminders, "send_drop_opening_reminder_email", _never_called)
    _, _, drop, notify = await _notify_ctx(db_session)
    drop.brand_tracker_stage = BrandTrackerStage.DROP_FINISHED.value
    await db_session.flush()

    result = await send_due_reminders(db_session)
    assert result["reminders_sent"] == 0
    assert notify.sent_at is None


async def test_notify_reminder_skips_unapproved_brand(db_session, monkeypatch) -> None:
    from app.models.brand import Brand
    from app.models.enums import BrandStatus

    monkeypatch.setattr(notify_reminders, "send_drop_opening_reminder_email", _never_called)
    _, _, drop, notify = await _notify_ctx(db_session)
    brand = await db_session.get(Brand, drop.brand_id)
    assert brand is not None
    brand.status = BrandStatus.PENDING_REVIEW.value
    await db_session.flush()

    result = await send_due_reminders(db_session)
    assert result["reminders_sent"] == 0
    assert notify.sent_at is None


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


async def test_on_login_enqueues_near_expiry() -> None:
    user = _org_with_token(days_to_expiry=10)
    bg = BackgroundTasks()
    await maybe_refresh_on_login(user, bg, FakeInstagramClient())
    assert len(bg.tasks) == 1


async def test_on_login_enqueues_last_day_not_expired() -> None:
    """Sub-day remaining must refresh, not raise INSTAGRAM_TOKEN_EXPIRED."""
    user = _org_with_token(days_to_expiry=0)
    user.instagram_token_expires_at = _now() + timedelta(hours=12)
    bg = BackgroundTasks()
    await maybe_refresh_on_login(user, bg, FakeInstagramClient())
    assert len(bg.tasks) == 1


async def test_on_login_raises_when_expired_and_clears_token() -> None:
    """Clock-expiry clears ciphertext + bumps token_version (undecryptable parity)."""
    from app.deps.db import async_session_factory, engine

    await engine.dispose()
    uid = uuid.uuid4()
    async with async_session_factory() as s:
        user = User(
            id=uid,
            portal_role="org",
            status="active",
            instagram_user_id=f"ig_exp_{uid.hex[:8]}",
            instagram_access_token=encrypt_token("expired-ll"),
            instagram_token_expires_at=_now() - timedelta(hours=1),
            token_version=3,
        )
        s.add(user)
        await s.commit()

    async with async_session_factory() as s:
        user = await s.get(User, uid)
        assert user is not None
        try:
            await maybe_refresh_on_login(user, BackgroundTasks(), FakeInstagramClient())
            raise AssertionError("expected INSTAGRAM_TOKEN_EXPIRED")
        except BuzzAPIException as exc:
            assert exc.code == "INSTAGRAM_TOKEN_EXPIRED"
        assert user.instagram_access_token is None
        assert user.token_version == 4

    try:
        async with async_session_factory() as s:
            row = await s.get(User, uid)
            assert row is not None
            assert row.instagram_access_token is None
            assert row.token_version == 4
    finally:
        async with async_session_factory() as s:
            row = await s.get(User, uid)
            if row is not None:
                await s.delete(row)
                await s.commit()


async def test_token_refresh_cron_includes_last_day(db_session) -> None:
    user = await persist(db_session, _org_with_token(days_to_expiry=0))
    user.instagram_token_expires_at = _now() + timedelta(hours=12)
    await db_session.flush()
    result = await refresh_due_tokens(db_session, FakeInstagramClient())
    assert result["candidates"] == 1
    assert result["refreshed"] == 1


async def test_on_login_noop_for_brand() -> None:
    brand_user = make_user()
    brand_user.portal_role = "brand"
    assert days_until_expiry(brand_user) is None
    bg = BackgroundTasks()
    await maybe_refresh_on_login(brand_user, bg, FakeInstagramClient())
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
    await make_social_post(db_session, org, caption="@nikeshoes are great")  # prefix → no match
    await make_social_post(db_session, org, caption="shoutout @nike.official")  # dotted → no match
    await make_social_post(db_session, org, caption="via @nike_official")  # underscore handle → no
    await make_social_post(
        db_session, org, caption="see instagram.com/@nike/reel/abc"
    )  # URL path → no
    result = await scan_autolink(db_session)
    assert result["suggestions_created"] == 1


async def test_autolink_matches_exact_underscore_handle(db_session) -> None:
    """Brand handle with underscore must still match the exact @mention."""

    org, _, _, _ = await _accepted_live_ctx(db_session, handle="nike_official")
    await make_social_post(db_session, org, caption="collab with @nike_official this week")
    await make_social_post(db_session, org, caption="not @nike alone")
    result = await scan_autolink(db_session)
    assert result["suggestions_created"] == 1


async def test_autolink_ignores_drop_finished(db_session) -> None:
    """Finished drops must not mint new suggestions (org UI is read-only there)."""

    org_user = await persist(db_session, make_user(instagram_user_id="ig_finished"))
    org = await make_org(db_session, org_user)
    brand = await make_brand(db_session)
    brand.instagram_handle = "nike"
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_FINISHED)
    await db_session.flush()
    await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
    await make_social_post(db_session, org, caption="love @nike after the drop")
    result = await scan_autolink(db_session)
    assert result["applications_scanned"] == 0
    assert result["suggestions_created"] == 0


async def test_autolink_ignores_awaiting_products(db_session) -> None:
    """Shipping stage defers mint until Active (no Suggested posts UI yet)."""

    org_user = await persist(db_session, make_user(instagram_user_id="ig_shipping"))
    org = await make_org(db_session, org_user)
    brand = await make_brand(db_session)
    brand.instagram_handle = "nike"
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.AWAITING_PRODUCTS)
    await db_session.flush()
    await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
    await make_social_post(db_session, org, caption="love @nike while shipping")
    result = await scan_autolink(db_session)
    assert result["applications_scanned"] == 0
    assert result["suggestions_created"] == 0


async def test_autolink_mints_after_advance_to_drop_active(db_session) -> None:
    """Posts seen during shipping remint once the drop reaches Active."""

    org_user = await persist(db_session, make_user(instagram_user_id="ig_remint"))
    org = await make_org(db_session, org_user)
    brand = await make_brand(db_session)
    brand.instagram_handle = "nike"
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.AWAITING_PRODUCTS)
    await db_session.flush()
    await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
    await make_social_post(db_session, org, caption="teaser @nike before active")

    shipping = await scan_autolink(db_session)
    assert shipping["suggestions_created"] == 0

    drop.brand_tracker_stage = BrandTrackerStage.DROP_ACTIVE.value
    await db_session.flush()
    active = await scan_autolink(db_session)
    assert active["applications_scanned"] == 1
    assert active["suggestions_created"] == 1


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
            token_hash=hash_token("bi-used"),
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
            token_hash=hash_token("bi-fresh"),
            email="c@x.com",
            expires_at=_now() + timedelta(days=3),
        )
    )
    await db_session.flush()
    result = await cleanup_tokens(db_session)
    assert result["brand_invite_tokens_deleted"] == 1
    remaining = list(await db_session.scalars(select(BrandInviteToken.token_hash)))
    assert remaining == [hash_token("bi-fresh")]


# --- token refresh edge cases ---


async def test_token_refresh_cron_counts_failures_and_keeps_token(db_session) -> None:
    user = await persist(db_session, _org_with_token(days_to_expiry=7))
    original = user.instagram_access_token
    result = await refresh_due_tokens(db_session, _FailingRefreshClient())
    assert result == {"candidates": 1, "refreshed": 0, "failed": 1, "skipped": 0}
    await db_session.refresh(user)
    assert user.instagram_access_token == original  # old token preserved


async def test_token_refresh_cron_skips_already_expired(db_session) -> None:
    user = make_user(instagram_user_id="ig_expired")
    user.instagram_access_token = encrypt_token("x")
    user.instagram_token_expires_at = _now() - timedelta(hours=1)
    await persist(db_session, user)
    result = await refresh_due_tokens(db_session, FakeInstagramClient())
    assert result["candidates"] == 0


async def test_on_login_noop_for_fresh_token() -> None:
    user = _org_with_token(days_to_expiry=45)
    bg = BackgroundTasks()
    await maybe_refresh_on_login(user, bg, FakeInstagramClient())
    assert len(bg.tasks) == 0


async def test_on_login_noop_without_token() -> None:
    user = make_user(instagram_user_id="ig_notoken")  # org, no IG token
    assert days_until_expiry(user) is None
    bg = BackgroundTasks()
    await maybe_refresh_on_login(user, bg, FakeInstagramClient())
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
    assert result["failures"] >= 1
    assert result["skipped_token"] >= 1


async def test_metric_sync_media_list_failure_counts(db_session) -> None:
    await _eligible_sync_org(db_session, suffix="listfail")
    result = await sync_metrics(db_session, _FailingMediaListClient())
    assert result["failures"] >= 1
    assert result["posts_discovered"] == 0


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


async def test_metric_sync_skips_story_discovery(db_session) -> None:
    """Stories must not be cataloged even if Graph returns them on /me/media."""

    await _eligible_sync_org(db_session, suffix="storydisc")
    fake = FakeInstagramClient()
    fake.media = [MediaRef(id="story1", timestamp="2030-01-01T00:00:00+0000")]
    fake.media_fields = {
        "story1": MediaFields(
            id="story1",
            caption="ephemeral",
            media_type="IMAGE",
            media_product_type="STORY",
            permalink="https://instagram.com/stories/story1",
            thumbnail_url=None,
            media_url=None,
            timestamp="2030-01-01T00:00:00+0000",
            like_count=1,
            comments_count=0,
        )
    }
    result = await sync_metrics(db_session, fake)
    assert result["posts_discovered"] == 0
    assert result["skipped_story"] == 1
    assert (
        await db_session.scalar(select(SocialPost).where(SocialPost.external_id == "story1"))
        is None
    )


async def test_metric_sync_applies_reel_insights(db_session) -> None:
    user, org = await _eligible_sync_org(db_session, suffix="reel")
    reel = _raw_post(
        org.id, caption="reel", posted_at=_now() - timedelta(hours=2), product_type="REELS"
    )
    db_session.add(reel)
    await db_session.flush()
    fake = FakeInstagramClient()
    fake.insights = {"reach": 300, "ig_reels_avg_watch_time": 1200, "reels_skip_rate": 0.42}
    await sync_metrics(db_session, fake)
    await db_session.refresh(reel)
    assert reel.reach == 300
    assert reel.ig_reels_avg_watch_time == 1200
    assert reel.reels_skip_rate == 0.42


async def test_metric_sync_keeps_basics_when_insights_fail(db_session) -> None:
    user, org = await _eligible_sync_org(db_session, suffix="insfail")
    post = _raw_post(
        org.id, caption="x", posted_at=_now() - timedelta(hours=2), likes=99, ext="insfail1"
    )
    post.reach = 50
    db_session.add(post)
    await db_session.flush()
    fake = _FailingInsightsClient()
    fake.media_fields = {
        "insfail1": MediaFields(
            id="insfail1",
            caption="updated",
            media_type="IMAGE",
            media_product_type="FEED",
            permalink="https://instagram.com/p/insfail1",
            thumbnail_url=None,
            media_url=None,
            timestamp="2030-01-01T00:00:00+0000",
            like_count=12,
            comments_count=3,
        )
    }
    result = await sync_metrics(db_session, fake)
    assert result["failures"] >= 1
    await db_session.refresh(post)
    assert post.likes == 12
    assert post.comments == 3
    assert post.reach == 50  # prior insights untouched
    assert post.metrics_updated_at is not None


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


async def test_job_runner_persists_job_run(db_session, monkeypatch) -> None:
    """``scripts/run_job.py`` writes a job_runs row per invocation."""
    import importlib.util
    from pathlib import Path

    from app.models.job_run import JobRun

    path = Path(__file__).resolve().parents[1] / "scripts" / "run_job.py"
    spec = importlib.util.spec_from_file_location("run_job_under_test", path)
    assert spec is not None and spec.loader is not None
    run_job = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(run_job)

    async def _noop(_db):
        return {"cleaned": 0}

    monkeypatch.setitem(run_job._JOBS, "token_cleanup", (_noop, False))

    class _Ctx:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, *args):
            return None

    monkeypatch.setattr(run_job, "async_session_factory", lambda: _Ctx())

    # Avoid committing the outer test transaction; flush is enough for assertions.
    async def _flush_only():
        await db_session.flush()

    monkeypatch.setattr(db_session, "commit", _flush_only)

    result = await run_job._run("token_cleanup")
    assert result == {"cleaned": 0}
    row = await db_session.scalar(select(JobRun).where(JobRun.job == "token_cleanup"))
    assert row is not None
    assert row.ok is True
    assert row.finished_at is not None
    assert row.summary == {"cleaned": 0}


async def test_job_runner_rolls_back_then_persists_failure(db_session, monkeypatch) -> None:
    """On exception: rollback job session, then write JobRun(ok=False) separately."""
    import importlib.util
    from pathlib import Path

    from app.models.job_run import JobRun

    path = Path(__file__).resolve().parents[1] / "scripts" / "run_job.py"
    spec = importlib.util.spec_from_file_location("run_job_fail_under_test", path)
    assert spec is not None and spec.loader is not None
    run_job = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(run_job)

    async def _boom(_db):
        raise RuntimeError("boom")

    monkeypatch.setitem(run_job._JOBS, "token_cleanup", (_boom, False))

    class _Ctx:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, *args):
            return None

    monkeypatch.setattr(run_job, "async_session_factory", lambda: _Ctx())

    async def _flush_only():
        await db_session.flush()

    monkeypatch.setattr(db_session, "commit", _flush_only)

    order: list[str] = []

    async def _fake_rollback():
        order.append("rollback")
        # Mimic session rollback: drop the in-flight JobRun from the identity map.
        for obj in list(db_session.new) + list(db_session.dirty):
            if isinstance(obj, JobRun):
                db_session.expunge(obj)

    monkeypatch.setattr(db_session, "rollback", _fake_rollback)

    failure_row: dict[str, JobRun | None] = {"row": None}

    async def _persist_failure(name: str, started):
        order.append("persist")
        row = JobRun(
            job=name,
            started_at=started,
            finished_at=_now(),
            ok=False,
            summary={"error": "job failed"},
        )
        failure_row["row"] = row
        db_session.add(row)
        await db_session.flush()

    monkeypatch.setattr(run_job, "_persist_failure_run", _persist_failure)

    with pytest.raises(RuntimeError, match="boom"):
        await run_job._run("token_cleanup")

    assert order == ["rollback", "persist"]
    assert failure_row["row"] is not None
    assert failure_row["row"].ok is False
    assert failure_row["row"].summary == {"error": "job failed"}
