"""Integration tests for ``GET /api/drops`` — the org browse feed (Stage 4)."""

from __future__ import annotations

from httpx import AsyncClient

from app.models.enums import ApplicationDecision, OrgUserStatus, PortalRole
from tests.conftest import (
    make_application,
    make_brand,
    make_drop,
    make_org,
    make_user,
    mint_access_token,
    mint_expired_access_token,
    persist,
)


async def test_feed_returns_drops_for_active_org(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    await make_org(db_session, user)
    brand = await make_brand(db_session)
    await make_drop(db_session, brand, title="Cold Brew")

    resp = await app_client.get(
        "/api/drops", headers={"Authorization": f"Bearer {mint_access_token(user)}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["error"] is None
    assert body["meta"] == {"page": 1, "per_page": 50, "total": 1}
    item = body["data"][0]
    # camelCase keys + epoch-ms numeric datetimes (matches the frontend Drop type).
    assert item["brandName"] == "Test Brand"
    assert item["title"] == "Cold Brew"
    assert isinstance(item["applyOpenAt"], int)
    assert isinstance(item["applyCloseAt"], int)
    assert item["acceptedCount"] == 0
    assert item["alreadyApplied"] is False
    assert "brandTrackerStage" not in item  # intentionally omitted (Stage 5)


async def test_feed_accepted_count_and_already_applied(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    org = await make_org(db_session, user)
    other_user = await persist(db_session, make_user(instagram_user_id="ig_other"))
    other_org = await make_org(db_session, other_user, org_name="Other Org")
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)

    # Another org is accepted; the caller has applied (not denied).
    await make_application(db_session, drop, other_org, decision=ApplicationDecision.ACCEPTED)
    await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)

    resp = await app_client.get(
        "/api/drops", headers={"Authorization": f"Bearer {mint_access_token(user)}"}
    )
    assert resp.status_code == 200
    item = resp.json()["data"][0]
    assert item["acceptedCount"] == 1
    assert item["alreadyApplied"] is True


async def test_feed_denied_application_is_not_already_applied(
    app_client: AsyncClient, db_session
) -> None:
    user = await persist(db_session, make_user())
    org = await make_org(db_session, user)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    await make_application(db_session, drop, org, decision=ApplicationDecision.DENIED)

    resp = await app_client.get(
        "/api/drops", headers={"Authorization": f"Bearer {mint_access_token(user)}"}
    )
    item = resp.json()["data"][0]
    assert item["alreadyApplied"] is False


async def test_feed_pagination_is_stable(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    await make_org(db_session, user)
    brand = await make_brand(db_session)
    for i in range(3):
        await make_drop(db_session, brand, title=f"Drop {i}")
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}

    p1 = await app_client.get("/api/drops?page=1&per_page=2", headers=headers)
    p2 = await app_client.get("/api/drops?page=2&per_page=2", headers=headers)
    assert p1.status_code == 200 and p2.status_code == 200
    assert p1.json()["meta"] == {"page": 1, "per_page": 2, "total": 3}
    ids1 = [d["id"] for d in p1.json()["data"]]
    ids2 = [d["id"] for d in p2.json()["data"]]
    assert len(ids1) == 2 and len(ids2) == 1
    # Stable order: pages are disjoint and together cover all 3 drops.
    assert set(ids1).isdisjoint(ids2)
    assert len(set(ids1) | set(ids2)) == 3


async def test_feed_per_page_clamped(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    resp = await app_client.get(
        "/api/drops?per_page=500",
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 422  # exceeds le=100
    # Validation failures use the standard error envelope (not FastAPI's detail).
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_feed_org_without_organization_row_ok(app_client: AsyncClient, db_session) -> None:
    # Active org user with no organizations row → no 500, alreadyApplied False.
    user = await persist(db_session, make_user())
    brand = await make_brand(db_session)
    await make_drop(db_session, brand)
    resp = await app_client.get(
        "/api/drops", headers={"Authorization": f"Bearer {mint_access_token(user)}"}
    )
    assert resp.status_code == 200
    assert resp.json()["data"][0]["alreadyApplied"] is False


async def test_feed_requires_auth(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/drops")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_feed_expired_token(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    resp = await app_client.get(
        "/api/drops",
        headers={"Authorization": f"Bearer {mint_expired_access_token(user)}"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "TOKEN_EXPIRED"


async def test_feed_forbidden_for_brand(app_client: AsyncClient, db_session) -> None:
    brand_user = await persist(db_session, make_user(role=PortalRole.BRAND))
    resp = await app_client.get(
        "/api/drops",
        headers={"Authorization": f"Bearer {mint_access_token(brand_user)}"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_feed_forbidden_for_non_active_org(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user(status=OrgUserStatus.PENDING_APPROVAL))
    resp = await app_client.get(
        "/api/drops", headers={"Authorization": f"Bearer {mint_access_token(user)}"}
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"
