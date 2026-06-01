"""Tests for ``GET /api/campaigns/{id}/aggregate`` (Stage 5B)."""

from __future__ import annotations

from httpx import AsyncClient

from app.models.enums import ApplicationDecision
from tests.conftest import (
    make_application,
    make_brand,
    make_drop,
    make_org,
    make_post_link,
    make_social_post,
    make_user,
    mint_access_token,
    persist,
)


async def test_aggregate_sums_linked_posts(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    org = await make_org(db_session, user)
    org.follower_count = 1240
    await db_session.flush()
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    application = await make_application(
        db_session, drop, org, decision=ApplicationDecision.ACCEPTED
    )
    p1 = await make_social_post(db_session, org, likes=10, comments=2)
    p2 = await make_social_post(db_session, org, likes=5, comments=3)
    await make_post_link(db_session, p1, application)
    await make_post_link(db_session, p2, application)

    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    resp = await app_client.get(f"/api/campaigns/{application.id}/aggregate", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["postCount"] == 2
    assert data["likes"] == 15
    assert data["comments"] == 5
    assert data["engagement"] == 20
    assert data["estimatedReach"] == 1240


async def test_aggregate_empty_campaign(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    org = await make_org(db_session, user)  # follower_count None -> reach 0
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    application = await make_application(
        db_session, drop, org, decision=ApplicationDecision.ACCEPTED
    )
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    resp = await app_client.get(f"/api/campaigns/{application.id}/aggregate", headers=headers)
    data = resp.json()["data"]
    assert data == {
        "postCount": 0,
        "likes": 0,
        "comments": 0,
        "engagement": 0,
        "estimatedReach": 0,
    }


async def test_aggregate_excludes_other_campaign_links(app_client: AsyncClient, db_session) -> None:
    # Same org, two campaigns; a post linked to campaign B must not count toward A.
    user = await persist(db_session, make_user())
    org = await make_org(db_session, user)
    brand = await make_brand(db_session)
    drop_a = await make_drop(db_session, brand, title="A")
    drop_b = await make_drop(db_session, brand, title="B")
    app_a = await make_application(db_session, drop_a, org, decision=ApplicationDecision.ACCEPTED)
    app_b = await make_application(db_session, drop_b, org, decision=ApplicationDecision.ACCEPTED)
    post_b = await make_social_post(db_session, org, likes=99, comments=99)
    await make_post_link(db_session, post_b, app_b)

    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    resp = await app_client.get(f"/api/campaigns/{app_a.id}/aggregate", headers=headers)
    data = resp.json()["data"]
    assert data["postCount"] == 0 and data["likes"] == 0 and data["comments"] == 0


async def test_aggregate_denied_campaign_404(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    org = await make_org(db_session, user)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    denied = await make_application(db_session, drop, org, decision=ApplicationDecision.DENIED)
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    resp = await app_client.get(f"/api/campaigns/{denied.id}/aggregate", headers=headers)
    assert resp.status_code == 404


async def test_aggregate_other_org_404(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    await make_org(db_session, user)
    # An application owned by a different org.
    other_user = await persist(db_session, make_user())
    other_org = await make_org(db_session, other_user, org_name="Other")
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    other_app = await make_application(
        db_session, drop, other_org, decision=ApplicationDecision.ACCEPTED
    )
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    resp = await app_client.get(f"/api/campaigns/{other_app.id}/aggregate", headers=headers)
    assert resp.status_code == 404
