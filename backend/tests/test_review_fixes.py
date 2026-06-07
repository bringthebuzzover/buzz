"""Stage 11 — fixes for validated review findings.

* B1 §7.1 — denied drop applicants receive an email.
* B2     — POST /api/auth/refresh is rate-limited.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.config import settings
from app.models.enums import ApplicationDecision, BrandTrackerStage, PortalRole
from app.security import rate_limit
from tests.conftest import (
    make_application,
    make_brand,
    make_drop,
    make_org,
    make_user,
    mint_access_token,
    persist,
)


async def _brand_ctx(db_session):
    brand_user = await persist(db_session, make_user(role=PortalRole.BRAND))
    brand = await make_brand(db_session)
    brand.user_id = brand_user.id
    await db_session.flush()
    headers = {"Authorization": f"Bearer {mint_access_token(brand_user)}"}
    return brand_user, brand, headers


# --- B1: application-denial emails (§7.1) ------------------------------------


async def test_finalize_emails_denied_applicants(
    app_client: AsyncClient, db_session, monkeypatch
) -> None:
    _, brand, headers = await _brand_ctx(db_session)
    past = datetime.now(timezone.utc) - timedelta(days=1)
    drop = await make_drop(
        db_session,
        brand,
        stage=BrandTrackerStage.FINALIZING_AGREEMENTS,
        apply_close_at=past,
        capacity_total=5,
    )
    accepted_user = await persist(db_session, make_user(instagram_user_id="ig_acc"))
    accepted_org = await make_org(db_session, accepted_user, org_name="Accepted Org")
    denied_user = await persist(db_session, make_user(instagram_user_id="ig_den"))
    denied_org = await make_org(db_session, denied_user, org_name="Denied Org")
    denied_org.edu_email = "denied@campus.edu"
    await make_application(db_session, drop, accepted_org, decision=ApplicationDecision.APPLIED)
    await make_application(db_session, drop, denied_org, decision=ApplicationDecision.APPLIED)
    await db_session.flush()

    sent: list[dict] = []

    async def _capture(to_email, **kwargs):
        sent.append({"to": to_email, **kwargs})

    monkeypatch.setattr("app.services.brands.send_application_denied_email", _capture)

    resp = await app_client.post(
        f"/api/brands/me/drops/{drop.id}/finalize-applicants",
        json={"allocations": [{"orgId": str(accepted_org.id), "units": 0}]},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["deniedCount"] == 1

    # Exactly the denied org was emailed (not the accepted one).
    assert len(sent) == 1
    assert sent[0]["to"] == "denied@campus.edu"
    assert sent[0]["org_name"] == "Denied Org"
    assert sent[0]["drop_title"] == drop.title
    assert sent[0]["brand_name"] == brand.brand_name


async def test_finalize_no_denied_no_email(
    app_client: AsyncClient, db_session, monkeypatch
) -> None:
    """All applicants accepted → no denial emails."""
    _, brand, headers = await _brand_ctx(db_session)
    past = datetime.now(timezone.utc) - timedelta(days=1)
    drop = await make_drop(
        db_session,
        brand,
        stage=BrandTrackerStage.FINALIZING_AGREEMENTS,
        apply_close_at=past,
    )
    user = await persist(db_session, make_user(instagram_user_id="ig_only"))
    org = await make_org(db_session, user)
    await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)
    await db_session.flush()

    sent: list[dict] = []

    async def _capture(to_email, **kwargs):
        sent.append({"to": to_email})

    monkeypatch.setattr("app.services.brands.send_application_denied_email", _capture)

    resp = await app_client.post(
        f"/api/brands/me/drops/{drop.id}/finalize-applicants",
        json={"allocations": [{"orgId": str(org.id), "units": 0}]},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert sent == []


# --- B2: /auth/refresh rate limit --------------------------------------------


@pytest.fixture
def _enable_rate_limit():
    prev = settings.RATE_LIMIT_ENABLED
    settings.RATE_LIMIT_ENABLED = True
    rate_limit.reset()
    yield
    settings.RATE_LIMIT_ENABLED = prev
    rate_limit.reset()


async def test_refresh_is_rate_limited(app_client: AsyncClient, _enable_rate_limit) -> None:
    # No cookie → 401 each call, but the per-IP limiter still counts; the 61st
    # (limit=60/60s) is throttled before the handler runs.
    statuses = [(await app_client.post("/api/auth/refresh")).status_code for _ in range(61)]
    assert statuses[:60] == [401] * 60
    assert statuses[60] == 429
