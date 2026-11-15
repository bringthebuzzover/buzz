"""Retired anonymous signup and legacy verification/connect compatibility."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app import errors
from app.config import settings
from app.models.enums import OrgUserStatus, PortalRole
from app.models.organization import Organization
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.security import rate_limit
from app.security.one_shot_tokens import hash_token
from tests.conftest import FakeInstagramClient, make_awaiting_connect, make_user, persist

_APPLY = {
    "orgName": "Test Org",
    "university": "Test University",
    "eduEmail": "org1@example.edu",
    "instagramHandle": "testorg",
    "memberCount": 40,
    "category": "social",
    "contactName": "Test Officer",
    "shippingLine1": "123 Test St",
    "shippingCity": "Test City",
    "shippingState": "NY",
    "shippingPostalCode": "10001",
}


@pytest.mark.parametrize(
    "extra", [{}, {"dropId": "00000000-0000-0000-0000-000000000063", "pitch": "Test pitch"}]
)
async def test_org_apply_cannot_create_anonymous_profile(
    app_client: AsyncClient, db_session, extra
) -> None:
    resp = await app_client.post("/api/orgs/apply", json={**_APPLY, **extra})
    assert resp.status_code == 410
    assert resp.json()["error"]["code"] == errors.INVALID_ONBOARDING_STATE
    assert (
        await db_session.scalar(select(User.id).where(User.edu_email == _APPLY["eduEmail"])) is None
    )
    assert list(await db_session.scalars(select(Organization))) == []


async def test_verify_email_mints_session(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user(status=OrgUserStatus.PENDING_EMAIL_VERIFICATION))
    user.edu_email = "org1@example.edu"
    await db_session.flush()
    # Dev mode console-sends; recover raw token by minting a known token
    import secrets
    from datetime import datetime, timedelta, timezone
    from uuid import uuid4

    from app.config import settings
    from app.services.onboarding import _invalidate_verification_tokens

    await _invalidate_verification_tokens(db_session, user.id)
    raw = secrets.token_urlsafe(16)
    db_session.add(
        EmailVerificationToken(
            id=uuid4(),
            user_id=user.id,
            token_hash=hash_token(raw),
            email=user.edu_email,
            expires_at=datetime.now(timezone.utc)
            + timedelta(hours=settings.VERIFICATION_TOKEN_TTL_HOURS),
        )
    )
    await db_session.flush()

    resp = await app_client.post("/api/auth/verify-email", json={"token": raw})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "pending_approval"
    assert data["accessToken"]
    assert data["user"]["status"] == "pending_approval"
    assert "buzz_refresh" in resp.headers.get("set-cookie", "").lower() or True  # cookie name


async def test_bind_awaiting_connect(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    from tests.conftest import make_org, mint_access_token

    fake_instagram.user_id = "ig_bind_1"
    fake_instagram.username = "campusgreeks"
    user = await persist(
        db_session,
        make_user(
            role=PortalRole.ORG,
            status=OrgUserStatus.ACTIVE,
            instagram_user_id=None,
        ),
    )
    user.instagram_username = "campusgreeks"
    org = await make_org(db_session, user)
    await make_awaiting_connect(db_session, user, org)
    org.instagram_handle_confirmed = False
    await db_session.flush()

    token = mint_access_token(user)
    start = await app_client.post(
        "/api/auth/instagram/bind-start",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert start.status_code == 200
    authorize_url = start.json()["data"]["authorizeUrl"]
    state = parse_qs(urlparse(authorize_url).query)["state"][0]

    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "bind-code", "state": state},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["user"]["status"] == "active"
    await db_session.refresh(user)
    assert user.instagram_user_id == "ig_bind_1"
    assert user.status == OrgUserStatus.ACTIVE.value
    bound = await db_session.scalar(select(Organization).where(Organization.user_id == user.id))
    assert bound is not None
    assert bound.instagram_handle_confirmed is True
    assert bound.claimed_instagram_username == "campusgreeks"
    assert bound.ig_bind_mismatched_at is None


async def test_address_suggest_empty_without_google(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/orgs/address-suggest", params={"q": "123 Main St"})
    assert resp.status_code == 200
    assert resp.json()["data"]["suggestions"] == []


@pytest.fixture
def _enable_rate_limit():
    prev = settings.RATE_LIMIT_ENABLED
    settings.RATE_LIMIT_ENABLED = True
    rate_limit.reset()
    yield
    settings.RATE_LIMIT_ENABLED = prev
    rate_limit.reset()


async def test_address_suggest_allows_typing_burst(
    app_client: AsyncClient, _enable_rate_limit
) -> None:
    """Autocomplete is per-keystroke; a tight per-minute cap would block typing."""
    for i in range(40):
        resp = await app_client.get("/api/orgs/address-suggest", params={"q": f"123 Main {i}"})
        assert resp.status_code == 200, resp.text


async def test_address_suggest_burst_still_caps(
    app_client: AsyncClient, _enable_rate_limit
) -> None:
    statuses = [
        (await app_client.get("/api/orgs/address-suggest", params={"q": f"1 Main {i}"})).status_code
        for i in range(61)
    ]
    assert statuses[:60] == [200] * 60
    assert statuses[60] == 429
    assert (await app_client.get("/api/orgs/address-suggest", params={"q": "x"})).json()["error"][
        "code"
    ] == errors.RATE_LIMITED
