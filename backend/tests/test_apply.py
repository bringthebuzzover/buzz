"""Tests for ``POST /api/drops/{id}/apply`` (Stage 5A)."""

from __future__ import annotations

import ast
import inspect
import uuid
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient

from app.models.enums import (
    ApplicationDecision,
    BrandStatus,
    OrgUserStatus,
    PortalRole,
)
from app.services.drops import apply_to_drop
from app.timeutils import utcnow
from tests.conftest import (
    admin_headers,
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
    drop = await make_drop(db_session, brand, wrapped_at=utcnow())

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
    )
    resp = await app_client.post(f"/api/drops/{drop.id}/apply", headers=headers, json={})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "DROP_NOT_OPEN"


async def test_reopen_is_editing_the_close_date(app_client: AsyncClient, db_session) -> None:
    """No reopen flag: BUZZ moves the close date and the drop is Applying again."""
    _, _, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    now = datetime.now(timezone.utc)
    drop = await make_drop(
        db_session,
        brand,
        apply_open_at=now - timedelta(days=8),
        apply_close_at=now - timedelta(days=1),
    )
    new_close_ms = int((now + timedelta(days=3)).timestamp() * 1000)
    patched = await app_client.patch(
        f"/api/admin/drops/{drop.id}",
        json={"applyCloseAt": new_close_ms},
        headers=await admin_headers(db_session),
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["data"]["stage"] == "applying"
    resp = await app_client.post(f"/api/drops/{drop.id}/apply", headers=headers, json={})
    assert resp.status_code == 200
    assert resp.json()["data"]["decision"] == ApplicationDecision.APPLIED.value


def _first_call_lineno(func: ast.AsyncFunctionDef, name: str) -> int | None:
    found: int | None = None
    for node in ast.walk(func):
        if not isinstance(node, ast.Call):
            continue
        target = node.func
        attr = target.id if isinstance(target, ast.Name) else getattr(target, "attr", None)
        if attr == name and (found is None or node.lineno < found):
            found = node.lineno
    return found


def test_apply_to_drop_locks_drop_before_eligibility() -> None:
    """Apply serializes on ``drops.id`` before accepted_count / eligibility.

    This contract blocks the unlocked-row TOCTOU vs a concurrent last-seat accept.
    """

    tree = ast.parse(inspect.getsource(apply_to_drop))
    func = tree.body[0]
    assert isinstance(func, ast.AsyncFunctionDef)
    lock_at = _first_call_lineno(func, "with_for_update")
    accepted_at = _first_call_lineno(func, "_accepted_counts")
    eligibility_at = _first_call_lineno(func, "drop_apply_eligibility")
    assert lock_at is not None
    assert accepted_at is not None
    assert eligibility_at is not None
    assert lock_at < accepted_at < eligibility_at


async def test_apply_wrapped_rejected_while_window_open(
    app_client: AsyncClient, db_session
) -> None:
    """A wrapped-up drop takes no applications even if its dates are open."""

    _, _, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, wrapped_at=datetime.now(timezone.utc))
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
    other_user = make_user()
    other_user.instagram_username = "otherorg"
    other_user = await persist(db_session, other_user)
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
