"""Tests for ``GET /api/orgs/me/posts`` + refresh stub (Stage 5B)."""

from __future__ import annotations

from httpx import AsyncClient

from app.models.enums import ApplicationDecision, OrgUserStatus, PortalRole
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


async def _ctx(db_session):
    user = await persist(db_session, make_user())
    org = await make_org(db_session, user)
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    return user, org, headers


async def test_list_posts_empty(app_client: AsyncClient, db_session) -> None:
    _, _, headers = await _ctx(db_session)
    resp = await app_client.get("/api/orgs/me/posts", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"] == []


async def test_list_posts_flattened_camelcase(app_client: AsyncClient, db_session) -> None:
    _, org, headers = await _ctx(db_session)
    await make_social_post(db_session, org, likes=10, comments=3)
    resp = await app_client.get("/api/orgs/me/posts", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    post = data[0]
    # flattened metrics + camelCase + epoch-ms
    assert post["likes"] == 10 and post["comments"] == 3
    assert isinstance(post["postedAt"], int)
    assert "mediaProductType" in post
    assert post["linkedApplicationId"] is None


async def test_list_posts_link_indicator(app_client: AsyncClient, db_session) -> None:
    user, org, headers = await _ctx(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    application = await make_application(
        db_session, drop, org, decision=ApplicationDecision.ACCEPTED
    )
    post = await make_social_post(db_session, org)
    await make_post_link(db_session, post, application)

    resp = await app_client.get("/api/orgs/me/posts", headers=headers)
    data = resp.json()["data"]
    assert data[0]["linkedApplicationId"] == str(application.id)
    assert data[0]["linkedDropId"] == str(drop.id)


async def test_refresh_returns_posts(app_client: AsyncClient, db_session) -> None:
    _, org, headers = await _ctx(db_session)
    await make_social_post(db_session, org)
    resp = await app_client.post("/api/orgs/me/posts/refresh", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1


async def test_list_posts_requires_auth(app_client: AsyncClient, db_session) -> None:
    resp = await app_client.get("/api/orgs/me/posts")
    assert resp.status_code == 401


async def test_list_posts_forbidden_for_brand(app_client: AsyncClient, db_session) -> None:
    brand_user = await persist(
        db_session, make_user(role=PortalRole.BRAND, status=OrgUserStatus.ACTIVE)
    )
    resp = await app_client.get(
        "/api/orgs/me/posts",
        headers={"Authorization": f"Bearer {mint_access_token(brand_user)}"},
    )
    assert resp.status_code == 403
