"""Tests for ``/api/campaigns`` (Stage 5A)."""

from __future__ import annotations

import uuid

from httpx import AsyncClient

from app.models.enums import (
    ApplicationDecision,
    BrandTrackerStage,
    OrgUserStatus,
    PortalRole,
)
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


async def test_list_excludes_denied(app_client: AsyncClient, db_session) -> None:
    _, org, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    applied_drop = await make_drop(db_session, brand, title="Applied Drop")
    denied_drop = await make_drop(db_session, brand, title="Denied Drop")
    await make_application(db_session, applied_drop, org, decision=ApplicationDecision.APPLIED)
    await make_application(db_session, denied_drop, org, decision=ApplicationDecision.DENIED)

    resp = await app_client.get("/api/campaigns", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    item = data[0]
    assert item["dropId"] == str(applied_drop.id)
    # joined drop fields present + camelCase
    assert item["title"] == "Applied Drop"
    assert item["brandName"] == brand.brand_name
    assert "image" in item and "brandTrackerStage" in item


async def test_list_sort_order(app_client: AsyncClient, db_session) -> None:
    _, org, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    # active(0) -> accepted(1) -> applied(2) -> finished(3)
    d_active = await make_drop(db_session, brand, title="A", stage=BrandTrackerStage.ACTIVE)
    d_accepted = await make_drop(db_session, brand, title="B", stage=BrandTrackerStage.SHIPPED)
    d_applied = await make_drop(
        db_session, brand, title="C", stage=BrandTrackerStage.AWAITING_BRIEF
    )
    d_finished = await make_drop(db_session, brand, title="D", stage=BrandTrackerStage.FINISHED)
    await make_application(db_session, d_active, org, decision=ApplicationDecision.ACCEPTED)
    await make_application(db_session, d_accepted, org, decision=ApplicationDecision.ACCEPTED)
    await make_application(db_session, d_applied, org, decision=ApplicationDecision.APPLIED)
    await make_application(db_session, d_finished, org, decision=ApplicationDecision.ACCEPTED)

    resp = await app_client.get("/api/campaigns", headers=headers)
    order = [item["dropId"] for item in resp.json()["data"]]
    assert order == [
        str(d_active.id),
        str(d_accepted.id),
        str(d_applied.id),
        str(d_finished.id),
    ]


async def test_detail_happy_path(app_client: AsyncClient, db_session) -> None:
    _, org, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    application = await make_application(
        db_session, drop, org, decision=ApplicationDecision.APPLIED, pitch="hi"
    )
    resp = await app_client.get(f"/api/campaigns/{application.id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == str(application.id)
    assert data["pitch"] == "hi"
    assert data["title"] == drop.title
    # camelCase + epoch-ms datetimes serialize as ints.
    assert isinstance(data["appliedAt"], int)
    assert isinstance(data["applyCloseAt"], int)


async def test_detail_denied_404(app_client: AsyncClient, db_session) -> None:
    _, org, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    application = await make_application(db_session, drop, org, decision=ApplicationDecision.DENIED)
    resp = await app_client.get(f"/api/campaigns/{application.id}", headers=headers)
    assert resp.status_code == 404


async def test_detail_other_org_404(app_client: AsyncClient, db_session) -> None:
    _, _, headers = await _org_ctx(db_session)
    # An application belonging to a different org.
    other_user = await persist(db_session, make_user())
    other_org = await make_org(db_session, other_user, org_name="Other")
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    application = await make_application(
        db_session, drop, other_org, decision=ApplicationDecision.APPLIED
    )
    resp = await app_client.get(f"/api/campaigns/{application.id}", headers=headers)
    assert resp.status_code == 404


async def test_detail_unknown_404(app_client: AsyncClient, db_session) -> None:
    _, _, headers = await _org_ctx(db_session)
    resp = await app_client.get(f"/api/campaigns/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404


async def test_list_requires_auth(app_client: AsyncClient, db_session) -> None:
    resp = await app_client.get("/api/campaigns")
    assert resp.status_code == 401


async def test_list_forbidden_for_brand(app_client: AsyncClient, db_session) -> None:
    brand_user = await persist(
        db_session, make_user(role=PortalRole.BRAND, status=OrgUserStatus.ACTIVE)
    )
    resp = await app_client.get(
        "/api/campaigns",
        headers={"Authorization": f"Bearer {mint_access_token(brand_user)}"},
    )
    assert resp.status_code == 403
