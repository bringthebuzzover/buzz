"""Tests for ``POST|DELETE /api/campaigns/{id}/link-post`` (Stage 5B)."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import func, select

from app.models.enums import ApplicationDecision, SocialMediaProductType
from app.models.post_link import PostCampaignLink
from app.models.post_suggestion import PostCampaignSuggestion
from tests.conftest import (
    make_application,
    make_brand,
    make_drop,
    make_org,
    make_post_link,
    make_social_post,
    make_suggestion,
    make_user,
    mint_access_token,
    persist,
)


async def _campaign_ctx(db_session, *, decision=ApplicationDecision.ACCEPTED):
    user = await persist(db_session, make_user())
    org = await make_org(db_session, user)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    application = await make_application(db_session, drop, org, decision=decision)
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    return user, org, drop, application, headers


async def _link_count(db_session, post_id) -> int:
    return await db_session.scalar(
        select(func.count())
        .select_from(PostCampaignLink)
        .where(PostCampaignLink.post_id == post_id)
    )


async def test_link_happy_path(app_client: AsyncClient, db_session) -> None:
    _, org, drop, application, headers = await _campaign_ctx(db_session)
    post = await make_social_post(db_session, org)
    resp = await app_client.post(
        f"/api/campaigns/{application.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["linkedApplicationId"] == str(application.id)
    assert await _link_count(db_session, post.id) == 1


async def test_link_idempotent_same_campaign(app_client: AsyncClient, db_session) -> None:
    _, org, _, application, headers = await _campaign_ctx(db_session)
    post = await make_social_post(db_session, org)
    await make_post_link(db_session, post, application)
    resp = await app_client.post(
        f"/api/campaigns/{application.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    assert resp.status_code == 200
    assert await _link_count(db_session, post.id) == 1


async def test_link_conflict_other_campaign(app_client: AsyncClient, db_session) -> None:
    user, org, drop, application, headers = await _campaign_ctx(db_session)
    # Same org, a second campaign; post already linked to the first.
    other_drop = await make_drop(db_session, await make_brand(db_session), title="Other")
    other_app = await make_application(
        db_session, other_drop, org, decision=ApplicationDecision.ACCEPTED
    )
    post = await make_social_post(db_session, org)
    await make_post_link(db_session, post, other_app)

    resp = await app_client.post(
        f"/api/campaigns/{application.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "POST_ALREADY_LINKED"


async def test_link_post_not_owned_404(app_client: AsyncClient, db_session) -> None:
    _, _, _, application, headers = await _campaign_ctx(db_session)
    # A post belonging to a different org.
    other_user = await persist(db_session, make_user())
    other_org = await make_org(db_session, other_user, org_name="Other")
    other_post = await make_social_post(db_session, other_org)
    resp = await app_client.post(
        f"/api/campaigns/{application.id}/link-post",
        headers=headers,
        json={"postId": str(other_post.id)},
    )
    assert resp.status_code == 404


async def test_link_other_org_campaign_404(app_client: AsyncClient, db_session) -> None:
    _, org, _, _, headers = await _campaign_ctx(db_session)
    # An application belonging to another org (IDOR attempt).
    other_user = await persist(db_session, make_user())
    other_org = await make_org(db_session, other_user, org_name="Other")
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    other_app = await make_application(
        db_session, drop, other_org, decision=ApplicationDecision.ACCEPTED
    )
    post = await make_social_post(db_session, org)
    resp = await app_client.post(
        f"/api/campaigns/{other_app.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    assert resp.status_code == 404


async def test_unlink_idempotent(app_client: AsyncClient, db_session) -> None:
    _, org, _, application, headers = await _campaign_ctx(db_session)
    post = await make_social_post(db_session, org)
    await make_post_link(db_session, post, application)
    r1 = await app_client.request(
        "DELETE",
        f"/api/campaigns/{application.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    assert r1.status_code == 200
    assert await _link_count(db_session, post.id) == 0
    # Unlinking again is a no-op success.
    r2 = await app_client.request(
        "DELETE",
        f"/api/campaigns/{application.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    assert r2.status_code == 200


async def test_unlink_wrong_application_leaves_link(app_client: AsyncClient, db_session) -> None:
    # Post linked to campaign A; unlinking via campaign B's path is a no-op for A.
    user, org, _, app_a, headers = await _campaign_ctx(db_session)
    drop_b = await make_drop(db_session, await make_brand(db_session), title="B")
    app_b = await make_application(db_session, drop_b, org, decision=ApplicationDecision.ACCEPTED)
    post = await make_social_post(db_session, org)
    await make_post_link(db_session, post, app_a)

    resp = await app_client.request(
        "DELETE",
        f"/api/campaigns/{app_b.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    assert resp.status_code == 200  # idempotent no-op
    assert await _link_count(db_session, post.id) == 1  # A's link untouched


async def test_link_denied_campaign_404(app_client: AsyncClient, db_session) -> None:
    user, org, _, _, headers = await _campaign_ctx(db_session)
    drop = await make_drop(db_session, await make_brand(db_session), title="Denied")
    denied = await make_application(db_session, drop, org, decision=ApplicationDecision.DENIED)
    post = await make_social_post(db_session, org)
    resp = await app_client.post(
        f"/api/campaigns/{denied.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    assert resp.status_code == 404


async def test_link_applied_campaign_404(app_client: AsyncClient, db_session) -> None:
    """Linking requires an ACCEPTED application — a still-applied org gets 404.

    This keeps post links accepted-only so the brand aggregate (accepted-only)
    and the org's view stay consistent (no undercount divergence)."""
    user, org, _, _, headers = await _campaign_ctx(db_session)
    drop = await make_drop(db_session, await make_brand(db_session), title="Applied")
    applied = await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)
    post = await make_social_post(db_session, org)
    resp = await app_client.post(
        f"/api/campaigns/{applied.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    assert resp.status_code == 404


async def test_unlink_rearms_confirmed_suggestion(app_client: AsyncClient, db_session) -> None:
    _, org, _, application, headers = await _campaign_ctx(db_session)
    post = await make_social_post(db_session, org)
    await make_post_link(db_session, post, application)
    suggestion = await make_suggestion(db_session, post, application)
    # Mark the suggestion confirmed (as accept would have).
    from datetime import datetime, timezone

    suggestion.confirmed_at = datetime.now(timezone.utc)
    await db_session.flush()

    await app_client.request(
        "DELETE",
        f"/api/campaigns/{application.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    refreshed = await db_session.scalar(
        select(PostCampaignSuggestion).where(PostCampaignSuggestion.id == suggestion.id)
    )
    assert refreshed.confirmed_at is None


async def test_link_dismisses_pending_suggestions(app_client: AsyncClient, db_session) -> None:
    """Manual link confirms this campaign's suggestion and dismisses siblings."""

    _, org, _, application, headers = await _campaign_ctx(db_session)
    other_drop = await make_drop(db_session, await make_brand(db_session), title="Other")
    other_app = await make_application(
        db_session, other_drop, org, decision=ApplicationDecision.ACCEPTED
    )
    post = await make_social_post(db_session, org)
    own = await make_suggestion(db_session, post, application)
    sibling = await make_suggestion(db_session, post, other_app)

    resp = await app_client.post(
        f"/api/campaigns/{application.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    assert resp.status_code == 200
    await db_session.refresh(own)
    await db_session.refresh(sibling)
    assert own.confirmed_at is not None and own.dismissed_at is None
    assert sibling.dismissed_at is not None


async def test_link_then_unlink_rearms_own_suggestion(app_client: AsyncClient, db_session) -> None:
    """Manual link must confirm (not dismiss) so unlink can re-arm the row."""

    _, org, _, application, headers = await _campaign_ctx(db_session)
    post = await make_social_post(db_session, org)
    own = await make_suggestion(db_session, post, application)

    await app_client.post(
        f"/api/campaigns/{application.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    await app_client.request(
        "DELETE",
        f"/api/campaigns/{application.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    await db_session.refresh(own)
    assert own.confirmed_at is None
    assert own.dismissed_at is None


async def test_link_post_rejected_when_drop_finished(app_client: AsyncClient, db_session) -> None:
    from app.models.enums import BrandTrackerStage

    user, org, drop, application, headers = await _campaign_ctx(db_session)
    drop.brand_tracker_stage = BrandTrackerStage.DROP_FINISHED.value
    await db_session.flush()
    post = await make_social_post(db_session, org)
    resp = await app_client.post(
        f"/api/campaigns/{application.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    assert resp.status_code == 400


async def test_link_post_rejects_story(app_client: AsyncClient, db_session) -> None:
    _, org, _, application, headers = await _campaign_ctx(db_session)
    post = await make_social_post(db_session, org, media_product_type=SocialMediaProductType.STORY)
    resp = await app_client.post(
        f"/api/campaigns/{application.id}/link-post",
        headers=headers,
        json={"postId": str(post.id)},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"
    assert await _link_count(db_session, post.id) == 0
