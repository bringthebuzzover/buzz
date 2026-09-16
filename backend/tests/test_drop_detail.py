"""Tests for ``GET /api/drops/{id}`` org-facing detail (Stage 5A)."""

from __future__ import annotations

import uuid

from httpx import AsyncClient

from app.models.enums import ApplicationDecision, BrandTrackerStage, OrgUserStatus, PortalRole
from tests.conftest import (
    make_application,
    make_brand,
    make_drop,
    make_org,
    make_user,
    mint_access_token,
    persist,
)


async def _org_ctx(db_session):
    user = await persist(db_session, make_user())
    org = await make_org(db_session, user)
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    return user, org, headers


async def test_detail_happy_path(app_client: AsyncClient, db_session) -> None:
    _, _, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, total_product_units=200)
    resp = await app_client.get(f"/api/drops/{drop.id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == str(drop.id)
    assert data["brandId"] == str(brand.id)
    assert data["totalProductUnits"] == 200
    assert data["acceptedCount"] == 0
    assert data["alreadyApplied"] is False
    assert data["applicantSelectionFinalizedAt"] is None
    # epoch-ms datetimes are ints.
    assert isinstance(data["applyOpenAt"], int)
    assert isinstance(data["createdAt"], int)
    # org detail omits the brand tracker stage (D1 deferral).
    assert "brandTrackerStage" not in data


async def test_detail_reflects_accepted_and_applied(app_client: AsyncClient, db_session) -> None:
    _, org, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, capacity_total=5)
    # Caller applied; another org accepted.
    await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)
    other_user = await persist(db_session, make_user())
    other_org = await make_org(db_session, other_user, org_name="Other")
    await make_application(db_session, drop, other_org, decision=ApplicationDecision.ACCEPTED)
    resp = await app_client.get(f"/api/drops/{drop.id}", headers=headers)
    data = resp.json()["data"]
    assert data["acceptedCount"] == 1
    assert data["alreadyApplied"] is True


async def test_detail_unknown_is_drop_not_open(app_client: AsyncClient, db_session) -> None:
    _, _, headers = await _org_ctx(db_session)
    resp = await app_client.get(f"/api/drops/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "DROP_NOT_OPEN"


async def test_detail_anonymous_public_fields(app_client: AsyncClient, db_session) -> None:
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    resp = await app_client.get(f"/api/drops/{drop.id}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["title"] == drop.title
    assert data["brandName"] == brand.brand_name
    assert data["alreadyApplied"] is False
    assert data["notifyRequested"] is False
    assert data["intentStatus"] is None
    assert data["totalProductUnits"] is None


async def test_detail_brand_jwt_gets_public_fields(app_client: AsyncClient, db_session) -> None:
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    brand_user = await persist(
        db_session, make_user(role=PortalRole.BRAND, status=OrgUserStatus.ACTIVE)
    )
    resp = await app_client.get(
        f"/api/drops/{drop.id}",
        headers={"Authorization": f"Bearer {mint_access_token(brand_user)}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["alreadyApplied"] is False
    assert resp.json()["data"]["notifyRequested"] is False


async def test_detail_rejects_finished_drop(app_client: AsyncClient, db_session) -> None:
    _, _, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_FINISHED)
    resp = await app_client.get(f"/api/drops/{drop.id}", headers=headers)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "DROP_NOT_OPEN"


async def test_detail_rejects_unapproved_brand(app_client: AsyncClient, db_session) -> None:
    from app.models.enums import BrandStatus

    _, _, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    brand.status = BrandStatus.PENDING_REVIEW.value
    await db_session.flush()
    drop = await make_drop(db_session, brand)
    resp = await app_client.get(f"/api/drops/{drop.id}", headers=headers)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "DROP_NOT_OPEN"
