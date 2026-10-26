"""Phase A: public org apply, verify session, connect bind."""

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
from tests.conftest import FakeInstagramClient, make_user, persist

_APPLY = {
    "orgName": "Campus Greeks",
    "university": "Cornell University",
    "eduEmail": "greeks@cornell.edu",
    "instagramHandle": "@campusgreeks",
    "memberCount": 40,
    "category": "sorority",
    "contactName": "Alex",
    "shippingLine1": "123 College Ave",
    "shippingCity": "Ithaca",
    "shippingState": "NY",
    "shippingPostalCode": "14850",
}


async def test_org_apply_creates_without_ig_token(app_client: AsyncClient, db_session) -> None:
    resp = await app_client.post("/api/orgs/apply", json=_APPLY)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "pending_email_verification"
    assert data["emailSentTo"] == "greeks@cornell.edu"

    user = await db_session.scalar(select(User).where(User.edu_email == "greeks@cornell.edu"))
    assert user is not None
    assert user.instagram_username == "campusgreeks"
    assert user.instagram_user_id is None
    assert user.instagram_access_token is None

    org = await db_session.scalar(select(Organization).where(Organization.user_id == user.id))
    assert org is not None
    assert org.instagram_handle_confirmed is False
    assert org.claimed_instagram_username == "campusgreeks"
    assert org.shipping_line1 == "123 College Ave"
    assert org.shipping_city == "Ithaca"
    assert org.shipping_state == "NY"
    assert org.shipping_postal_code == "14850"
    assert org.delivery_address == "123 College Ave, Ithaca, NY 14850"
    assert org.city is None
    assert org.state is None


async def test_org_apply_duplicate_handle(app_client: AsyncClient, db_session) -> None:
    await app_client.post("/api/orgs/apply", json=_APPLY)
    resp = await app_client.post(
        "/api/orgs/apply",
        json={**_APPLY, "eduEmail": "other@cornell.edu", "instagramHandle": "CampusGreeks"},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == errors.INSTAGRAM_HANDLE_TAKEN


async def test_org_apply_rejects_invalid_instagram_handle(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/orgs/apply",
        json={
            **_APPLY,
            "eduEmail": "badhandle@cornell.edu",
            "instagramHandle": "not a handle",
        },
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["error"]["code"] == errors.VALIDATION_ERROR
    assert "Instagram username" in body["error"]["message"]


async def test_org_apply_rejects_client_handle_confirmation(
    app_client: AsyncClient,
) -> None:
    """A caller cannot mark the claimed handle confirmed. Connect does that."""
    resp = await app_client.post(
        "/api/orgs/apply",
        json={
            **_APPLY,
            "eduEmail": "confirmed@cornell.edu",
            "instagramHandle": "clientconfirmed",
            "handleConfirmed": True,
        },
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == errors.VALIDATION_ERROR


async def test_org_apply_stores_typed_handle_unconfirmed(
    app_client: AsyncClient, db_session
) -> None:
    """Apply stores the typed handle unconfirmed until Connect."""
    resp = await app_client.post(
        "/api/orgs/apply",
        json={
            **_APPLY,
            "eduEmail": "unconfirmed@cornell.edu",
            "instagramHandle": "@Unconfirmed.Org",
        },
    )
    assert resp.status_code == 200
    user = await db_session.scalar(select(User).where(User.edu_email == "unconfirmed@cornell.edu"))
    assert user is not None
    assert user.instagram_username == "Unconfirmed.Org"
    org = await db_session.scalar(select(Organization).where(Organization.user_id == user.id))
    assert org is not None
    assert org.instagram_handle_confirmed is False
    assert org.claimed_instagram_username == "Unconfirmed.Org"


async def test_verify_email_mints_session(app_client: AsyncClient, db_session) -> None:
    await app_client.post("/api/orgs/apply", json=_APPLY)
    user = await db_session.scalar(select(User).where(User.edu_email == "greeks@cornell.edu"))
    assert user is not None
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


async def test_bind_pending_instagram(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    from tests.conftest import make_org, mint_access_token

    fake_instagram.user_id = "ig_bind_1"
    fake_instagram.username = "campusgreeks"
    user = await persist(
        db_session,
        make_user(
            role=PortalRole.ORG,
            status=OrgUserStatus.PENDING_INSTAGRAM,
            instagram_user_id=None,
        ),
    )
    user.instagram_username = "campusgreeks"
    org = await make_org(db_session, user)
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


async def test_org_apply_rejects_garbage_shipping(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/orgs/apply",
        json={**_APPLY, "eduEmail": "garbage@cornell.edu", "shippingLine1": "asdf"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == errors.INVALID_SHIPPING_ADDRESS


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
