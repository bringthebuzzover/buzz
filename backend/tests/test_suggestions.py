"""Tests for ``/api/campaigns/{id}/suggestions`` accept/dismiss (Stage 5B)."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import func, select

from app.models.enums import ApplicationDecision
from app.models.post_link import PostCampaignLink
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


async def _ctx(db_session):
    user = await persist(db_session, make_user())
    org = await make_org(db_session, user)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    application = await make_application(
        db_session, drop, org, decision=ApplicationDecision.ACCEPTED
    )
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    return user, org, drop, application, headers


async def test_list_pending_only(app_client: AsyncClient, db_session) -> None:
    _, org, _, application, headers = await _ctx(db_session)
    pending_post = await make_social_post(db_session, org, caption="pending")
    await make_suggestion(db_session, pending_post, application)
    # A dismissed suggestion must not appear.
    from datetime import datetime, timezone

    dismissed_post = await make_social_post(db_session, org, caption="dismissed")
    dismissed = await make_suggestion(db_session, dismissed_post, application)
    dismissed.dismissed_at = datetime.now(timezone.utc)
    await db_session.flush()

    resp = await app_client.get(f"/api/campaigns/{application.id}/suggestions", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["postId"] == str(pending_post.id)
    assert data[0]["matchReason"] == "brand_handle_caption"
    assert isinstance(data[0]["postedAt"], int)


async def test_accept_links_and_confirms(app_client: AsyncClient, db_session) -> None:
    _, org, _, application, headers = await _ctx(db_session)
    post = await make_social_post(db_session, org)
    await make_suggestion(db_session, post, application)
    resp = await app_client.post(
        f"/api/campaigns/{application.id}/suggestions/{post.id}/accept", headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["linkedApplicationId"] == str(application.id)
    # link row created.
    count = await db_session.scalar(
        select(func.count())
        .select_from(PostCampaignLink)
        .where(PostCampaignLink.post_id == post.id)
    )
    assert count == 1
    # suggestion no longer pending → not listed.
    listed = await app_client.get(f"/api/campaigns/{application.id}/suggestions", headers=headers)
    assert listed.json()["data"] == []


async def test_accept_idempotent_when_already_linked_same_campaign(
    app_client: AsyncClient, db_session
) -> None:
    # Post manually linked to THIS campaign while the suggestion stays pending.
    _, org, _, application, headers = await _ctx(db_session)
    post = await make_social_post(db_session, org)
    await make_suggestion(db_session, post, application)
    await make_post_link(db_session, post, application)

    resp = await app_client.post(
        f"/api/campaigns/{application.id}/suggestions/{post.id}/accept", headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["linkedApplicationId"] == str(application.id)
    # Still exactly one link; suggestion now reconciled (no longer pending).
    count = await db_session.scalar(
        select(func.count())
        .select_from(PostCampaignLink)
        .where(PostCampaignLink.post_id == post.id)
    )
    assert count == 1
    listed = await app_client.get(f"/api/campaigns/{application.id}/suggestions", headers=headers)
    assert listed.json()["data"] == []


async def test_accept_conflict_already_linked(app_client: AsyncClient, db_session) -> None:
    _, org, _, application, headers = await _ctx(db_session)
    post = await make_social_post(db_session, org)
    await make_suggestion(db_session, post, application)
    # Post already linked elsewhere (same org, different campaign).
    other_drop = await make_drop(db_session, await make_brand(db_session), title="Other")
    other_app = await make_application(
        db_session, other_drop, org, decision=ApplicationDecision.ACCEPTED
    )
    await make_post_link(db_session, post, other_app)

    resp = await app_client.post(
        f"/api/campaigns/{application.id}/suggestions/{post.id}/accept", headers=headers
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "POST_ALREADY_LINKED"


async def test_accept_no_pending_404(app_client: AsyncClient, db_session) -> None:
    _, org, _, application, headers = await _ctx(db_session)
    post = await make_social_post(db_session, org)  # no suggestion
    resp = await app_client.post(
        f"/api/campaigns/{application.id}/suggestions/{post.id}/accept", headers=headers
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "SUGGESTION_NOT_FOUND"


async def test_dismiss_then_gone(app_client: AsyncClient, db_session) -> None:
    _, org, _, application, headers = await _ctx(db_session)
    post = await make_social_post(db_session, org)
    await make_suggestion(db_session, post, application)
    r1 = await app_client.post(
        f"/api/campaigns/{application.id}/suggestions/{post.id}/dismiss", headers=headers
    )
    assert r1.status_code == 200
    listed = await app_client.get(f"/api/campaigns/{application.id}/suggestions", headers=headers)
    assert listed.json()["data"] == []
    # Dismissing again → no pending suggestion → 404.
    r2 = await app_client.post(
        f"/api/campaigns/{application.id}/suggestions/{post.id}/dismiss", headers=headers
    )
    assert r2.status_code == 404


async def test_suggestions_other_org_404(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    await make_org(db_session, user)
    other_user = await persist(db_session, make_user())
    other_org = await make_org(db_session, other_user, org_name="Other")
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    other_app = await make_application(
        db_session, drop, other_org, decision=ApplicationDecision.ACCEPTED
    )
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    resp = await app_client.get(f"/api/campaigns/{other_app.id}/suggestions", headers=headers)
    assert resp.status_code == 404
