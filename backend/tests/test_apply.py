"""Tests for ``POST /api/drops/{id}/apply`` (Stage 5A)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient

from app.models.enums import (
    ApplicationDecision,
    BrandStatus,
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


async def test_apply_happy_path(app_client: AsyncClient, db_session) -> None:
    _, org, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    resp = await app_client.post(
        f"/api/drops/{drop.id}/apply", headers=headers, json={"pitch": "We love it"}
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["decision"] == ApplicationDecision.APPLIED.value
    assert data["dropId"] == str(drop.id)
    assert data["orgId"] == str(org.id)
    assert data["pitch"] == "We love it"


async def test_apply_already_applied(app_client: AsyncClient, db_session) -> None:
    _, org, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)
    resp = await app_client.post(f"/api/drops/{drop.id}/apply", headers=headers, json={})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "ALREADY_APPLIED"


async def test_apply_denied_does_not_block(app_client: AsyncClient, db_session) -> None:
    _, org, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    await make_application(db_session, drop, org, decision=ApplicationDecision.DENIED)
    resp = await app_client.post(f"/api/drops/{drop.id}/apply", headers=headers, json={})
    assert resp.status_code == 200
    assert resp.json()["data"]["decision"] == ApplicationDecision.APPLIED.value


async def test_apply_rejected_for_non_approved_brand(app_client: AsyncClient, db_session) -> None:
    """The feed hides these, but a deep link must not slip past (§6.3)."""

    _, _, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    brand.status = BrandStatus.DENIED.value
    drop = await make_drop(db_session, brand)
    await db_session.flush()

    resp = await app_client.post(f"/api/drops/{drop.id}/apply", headers=headers, json={})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "DROP_NOT_OPEN"


async def test_apply_rejected_for_finished_drop(app_client: AsyncClient, db_session) -> None:
    _, _, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_FINISHED)

    resp = await app_client.post(f"/api/drops/{drop.id}/apply", headers=headers, json={})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "DROP_NOT_OPEN"


async def test_apply_upcoming_drop_not_open(app_client: AsyncClient, db_session) -> None:
    _, _, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    now = datetime.now(timezone.utc)
    drop = await make_drop(
        db_session,
        brand,
        apply_open_at=now + timedelta(days=1),
        apply_close_at=now + timedelta(days=8),
    )
    resp = await app_client.post(f"/api/drops/{drop.id}/apply", headers=headers, json={})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "DROP_NOT_OPEN"


async def test_apply_closed_window_not_open(app_client: AsyncClient, db_session) -> None:
    _, _, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    now = datetime.now(timezone.utc)
    drop = await make_drop(
        db_session,
        brand,
        apply_open_at=now - timedelta(days=8),
        apply_close_at=now - timedelta(days=1),
        manual_reopen=False,
    )
    resp = await app_client.post(f"/api/drops/{drop.id}/apply", headers=headers, json={})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "DROP_NOT_OPEN"


async def test_apply_manual_reopen_past_close_allowed(app_client: AsyncClient, db_session) -> None:
    _, _, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    now = datetime.now(timezone.utc)
    # Window closed, but manual_reopen overrides the auto-close.
    drop = await make_drop(
        db_session,
        brand,
        apply_open_at=now - timedelta(days=8),
        apply_close_at=now - timedelta(days=1),
        manual_reopen=True,
    )
    resp = await app_client.post(f"/api/drops/{drop.id}/apply", headers=headers, json={})
    assert resp.status_code == 200
    assert resp.json()["data"]["decision"] == ApplicationDecision.APPLIED.value


async def test_apply_finalized_rejected_while_window_open(
    app_client: AsyncClient, db_session
) -> None:
    """Finalized selection blocks apply even if the window is otherwise open."""

    _, _, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    now = datetime.now(timezone.utc)
    drop = await make_drop(
        db_session,
        brand,
        apply_open_at=now - timedelta(days=1),
        apply_close_at=now + timedelta(days=7),
        manual_reopen=False,
    )
    drop.applicant_selection_finalized_at = now
    await db_session.flush()

    resp = await app_client.post(f"/api/drops/{drop.id}/apply", headers=headers, json={})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "DROP_NOT_OPEN"


async def test_apply_blank_pitch_stored_as_null(app_client: AsyncClient, db_session) -> None:
    _, _, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    resp = await app_client.post(
        f"/api/drops/{drop.id}/apply", headers=headers, json={"pitch": "   "}
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["pitch"] is None
    # epoch-ms datetime is serialized as an int, not an ISO string.
    assert isinstance(data["appliedAt"], int)
    assert data["decisionAt"] is None


async def test_apply_capacity_exceeded(app_client: AsyncClient, db_session) -> None:
    _, _, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, capacity_total=1)
    # Another org already accepted → no spots remain.
    other_user = await persist(db_session, make_user())
    other_org = await make_org(db_session, other_user, org_name="Other Org")
    await make_application(db_session, drop, other_org, decision=ApplicationDecision.ACCEPTED)
    resp = await app_client.post(f"/api/drops/{drop.id}/apply", headers=headers, json={})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "CAPACITY_EXCEEDED"


async def test_apply_unknown_drop_404(app_client: AsyncClient, db_session) -> None:
    _, _, headers = await _org_ctx(db_session)
    resp = await app_client.post(f"/api/drops/{uuid.uuid4()}/apply", headers=headers, json={})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_apply_forbidden_for_brand(app_client: AsyncClient, db_session) -> None:
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    brand_user = await persist(
        db_session, make_user(role=PortalRole.BRAND, status=OrgUserStatus.ACTIVE)
    )
    resp = await app_client.post(
        f"/api/drops/{drop.id}/apply",
        headers={"Authorization": f"Bearer {mint_access_token(brand_user)}"},
        json={},
    )
    assert resp.status_code == 403


async def test_apply_requires_auth(app_client: AsyncClient, db_session) -> None:
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    resp = await app_client.post(f"/api/drops/{drop.id}/apply", json={})
    assert resp.status_code == 401
