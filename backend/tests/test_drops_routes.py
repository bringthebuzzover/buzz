"""Integration tests for ``GET /api/drops`` — the org browse feed (Stage 4)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from httpx import AsyncClient

from app.models.enums import (
    ApplicationDecision,
    BrandStatus,
    OrgUserStatus,
    PortalRole,
)
from app.timeutils import utcnow
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


async def test_feed_hides_non_approved_brands(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    await make_org(db_session, user)
    approved = await make_brand(db_session, brand_name="Approved")
    await make_drop(db_session, approved, title="Visible")
    for status in (BrandStatus.DENIED, BrandStatus.PENDING_REVIEW):
        brand = await make_brand(db_session, brand_name=status.value)
        brand.status = status.value
        await make_drop(db_session, brand, title=f"Hidden {status.value}")
    await db_session.flush()

    resp = await app_client.get(
        "/api/drops", headers={"Authorization": f"Bearer {mint_access_token(user)}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert [d["title"] for d in body["data"]] == ["Visible"]
    assert body["meta"]["total"] == 1  # total tracks the filter, not the table


async def test_feed_hides_unpublished(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    await make_org(db_session, user)
    brand = await make_brand(db_session)
    await make_drop(db_session, brand, title="Draft", published_at=None)
    await make_drop(db_session, brand, title="Live")

    resp = await app_client.get(
        "/api/drops", headers={"Authorization": f"Bearer {mint_access_token(user)}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert [d["title"] for d in body["data"]] == ["Live"]
    assert body["meta"]["total"] == 1


async def test_feed_hides_finished_drops(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    await make_org(db_session, user)
    brand = await make_brand(db_session)
    await make_drop(db_session, brand, title="Live")
    await make_drop(db_session, brand, title="Finished", wrapped_at=utcnow())

    resp = await app_client.get(
        "/api/drops", headers={"Authorization": f"Bearer {mint_access_token(user)}"}
    )
    body = resp.json()
    assert [d["title"] for d in body["data"]] == ["Live"]
    assert body["meta"]["total"] == 1


async def test_feed_keeps_upcoming_and_excludes_closed(app_client: AsyncClient, db_session) -> None:

    user = await persist(db_session, make_user())
    await make_org(db_session, user)
    brand = await make_brand(db_session)
    now = datetime.now(timezone.utc)
    await make_drop(
        db_session,
        brand,
        title="Upcoming",
        apply_open_at=now + timedelta(days=1),
        apply_close_at=now + timedelta(days=8),
    )
    await make_drop(
        db_session,
        brand,
        title="Closed",
        apply_open_at=now - timedelta(days=8),
        apply_close_at=now - timedelta(days=1),
    )

    resp = await app_client.get(
        "/api/drops", headers={"Authorization": f"Bearer {mint_access_token(user)}"}
    )
    assert {d["title"] for d in resp.json()["data"]} == {"Upcoming"}


async def test_feed_pagination_orders_open_before_upcoming(
    app_client: AsyncClient, db_session
) -> None:
    user = await persist(db_session, make_user())
    await make_org(db_session, user)
    brand = await make_brand(db_session)
    now = utcnow()
    drops = []
    for i, upcoming in enumerate([True, False, True, False]):
        drop = await make_drop(
            db_session,
            brand,
            title=f"Drop {i}",
            apply_open_at=now + timedelta(days=1) if upcoming else now - timedelta(days=1),
        )
        drop.created_at = now + timedelta(minutes=i // 2)
        drop.id = UUID(int=i + 1)
        drops.append(drop)
    await db_session.flush()
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}

    pages = [
        await app_client.get(f"/api/drops?page={page}&per_page=2", headers=headers)
        for page in (1, 2)
    ]
    for page, response in enumerate(pages, 1):
        assert response.status_code == 200
        assert response.json()["meta"] == {"page": page, "per_page": 2, "total": 4}
    assert [[item["id"] for item in response.json()["data"]] for response in pages] == [
        [str(drops[3].id), str(drops[1].id)],
        [str(drops[2].id), str(drops[0].id)],
    ]


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


async def test_feed_status_filters_apply_before_count_and_pagination(
    app_client: AsyncClient, db_session
) -> None:
    user = await persist(db_session, make_user())
    org = await make_org(db_session, user)
    brand = await make_brand(db_session)
    now = utcnow()
    upcoming = await make_drop(
        db_session,
        brand,
        title="Upcoming",
        apply_open_at=now + timedelta(days=1),
        apply_close_at=now + timedelta(days=8),
    )
    open_drop = await make_drop(db_session, brand, title="Open")
    full = await make_drop(db_session, brand, title="Full", capacity_total=1)
    await make_application(db_session, full, org, decision=ApplicationDecision.ACCEPTED)
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}

    all_page = await app_client.get("/api/drops?status=all&per_page=1", headers=headers)
    upcoming_page = await app_client.get("/api/drops?status=upcoming", headers=headers)
    open_page = await app_client.get("/api/drops?status=open", headers=headers)

    assert all_page.json()["meta"]["total"] == 2
    assert upcoming_page.json()["meta"]["total"] == 1
    assert [item["id"] for item in upcoming_page.json()["data"]] == [str(upcoming.id)]
    assert open_page.json()["meta"]["total"] == 1
    assert [item["id"] for item in open_page.json()["data"]] == [str(open_drop.id)]


@pytest.mark.parametrize(
    "excluded", ["hidden", "wrapped", "canceled", "draft", "expired", "unapproved"]
)
async def test_public_catalog_exclusions_and_privacy(
    app_client: AsyncClient, db_session, excluded
) -> None:
    brand = await make_brand(db_session, company_email="private-brand@example.test")
    now = utcnow()
    public = await make_drop(db_session, brand)
    user = await persist(db_session, make_user())
    user.edu_email = "private-org@example.edu"
    org = await make_org(db_session, user)
    org.contact_name = "Private Contact Canary"
    org.delivery_address = "123 Test Address Canary"
    await make_application(db_session, public, org)
    private_brand = await make_brand(db_session, company_email="private-other@example.test")
    private = await make_drop(db_session, private_brand)
    if excluded in {"hidden", "wrapped", "canceled"}:
        setattr(private, f"{excluded}_at", now)
    elif excluded == "draft":
        private.published_at = None
    elif excluded == "expired":
        private.apply_open_at = now - timedelta(days=2)
        private.apply_close_at = now - timedelta(days=1)
    else:
        private_brand.status = BrandStatus.PENDING_REVIEW.value
    await db_session.flush()

    response = await app_client.get("/api/drops/public")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["total"] == 1
    assert [item["id"] for item in body["data"]] == [str(public.id)]
    assert set(body["data"][0]) == {
        "id",
        "brandName",
        "title",
        "description",
        "image",
        "location",
        "capacityTotal",
        "applyOpenAt",
        "applyCloseAt",
        "stage",
    }
    for private_field in (
        "address",
        "email",
        "contact",
        "private-brand",
        "private-other",
        "canary",
        "private-org",
    ):
        assert private_field not in response.text.lower()


@pytest.mark.parametrize(
    ("open_delta", "close_delta", "stage"),
    [(1, 2, "upcoming"), (0, 1, "applying"), (-1, 0, "applying"), (-2, -1, None)],
)
async def test_public_catalog_date_boundaries(
    app_client: AsyncClient, db_session, monkeypatch, open_delta, close_delta, stage
) -> None:
    now = utcnow()
    monkeypatch.setattr("app.services.drops.utcnow", lambda: now)
    brand = await make_brand(db_session)
    await make_drop(
        db_session,
        brand,
        apply_open_at=now + timedelta(microseconds=open_delta),
        apply_close_at=now + timedelta(microseconds=close_delta),
    )

    response = await app_client.get("/api/drops/public")

    assert response.status_code == 200
    assert response.json()["meta"]["total"] == int(stage is not None)
    assert [item["stage"] for item in response.json()["data"]] == ([] if stage is None else [stage])


async def test_public_catalog_page_two_order_and_count(app_client: AsyncClient, db_session) -> None:
    brand = await make_brand(db_session)
    now = utcnow()
    drops = []
    for i in range(4):
        drop = await make_drop(db_session, brand)
        drop.created_at = now + timedelta(minutes=i // 2)
        drop.id = UUID(int=i + 1)
        drops.append(drop)
    await make_drop(db_session, brand, published_at=None)
    await db_session.flush()

    for page, expected in ((1, drops[2:][::-1]), (2, drops[:2][::-1])):
        response = await app_client.get(f"/api/drops/public?page={page}&per_page=2")
        assert response.status_code == 200
        assert response.json()["meta"] == {"page": page, "per_page": 2, "total": 4}
        assert [item["id"] for item in response.json()["data"]] == [
            str(drop.id) for drop in expected
        ]


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
