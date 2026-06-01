"""Instagram OAuth login + callback flow (architecture.md §3.4).

Uses ``FakeInstagramClient`` (via ``fake_instagram``) so no network/secrets
are needed. ``app_client`` shares the rolled-back ``db_session``.
"""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

from httpx import AsyncClient
from sqlalchemy import select

from app.config import settings
from app.models.user import User
from app.security import jwt
from app.security.token_crypto import decrypt_token
from tests.conftest import FakeInstagramClient


async def test_login_redirects_with_state(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient
) -> None:
    resp = await app_client.get("/api/auth/instagram/login", follow_redirects=False)
    assert resp.status_code == 302
    location = resp.headers["location"]
    query = parse_qs(urlparse(location).query)
    assert query["response_type"] == ["code"]
    assert "client_id" in query
    assert "scope" in query
    # The state must be a valid, decodable oauth_state token.
    state = query["state"][0]
    payload = jwt.decode_token(state, expected_type=jwt.OAUTH_STATE_TOKEN_TYPE)
    assert payload.type == "oauth_state"
    # The state is also bound to the browser via a cookie.
    assert "buzz_oauth_state" in resp.headers.get("set-cookie", "")


async def _begin_login(client: AsyncClient) -> str:
    """Drive ``/login`` to get a state whose cookie is now in the client jar."""

    resp = await client.get("/api/auth/instagram/login", follow_redirects=False)
    location = resp.headers["location"]
    return parse_qs(urlparse(location).query)["state"][0]


async def test_callback_business_account_creates_org_user(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_business_1"
    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "oauth-code", "state": state},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["error"] is None
    data = body["data"]
    assert data["access_token"]
    assert data["user"]["portal_role"] == "org"
    assert data["user"]["status"] == "pending_org_profile"
    # Refresh cookie set, httpOnly.
    set_cookie = resp.headers.get("set-cookie", "")
    assert settings.REFRESH_COOKIE_NAME in set_cookie
    assert "httponly" in set_cookie.lower()

    user = await db_session.scalar(select(User).where(User.instagram_user_id == "ig_business_1"))
    assert user is not None
    assert user.instagram_username == "testorg"
    # Token is encrypted at rest (not the fake's plaintext) and round-trips.
    assert user.instagram_access_token != fake_instagram.long_lived_token
    assert decrypt_token(user.instagram_access_token) == fake_instagram.long_lived_token


async def test_callback_creator_account_ok(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient
) -> None:
    fake_instagram.account_type = "CREATOR"
    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 200


async def test_callback_personal_account_rejected(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient
) -> None:
    fake_instagram.account_type = "PERSONAL"
    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INSTAGRAM_PERSONAL_ACCOUNT"


async def test_callback_bad_state_unauthorized(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient
) -> None:
    # Even with a started login (valid cookie), a garbage state must fail.
    await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": "not-a-valid-token"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_callback_without_state_cookie_unauthorized(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient
) -> None:
    # No /login first → no state cookie → CSRF binding fails even though the
    # state is a validly-signed token.
    state = jwt.create_oauth_state_token()
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_callback_state_cookie_mismatch_unauthorized(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient
) -> None:
    # Cookie from a real login, but a *different* valid state submitted →
    # double-submit mismatch → 401.
    await _begin_login(app_client)
    other_state = jwt.create_oauth_state_token()
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": other_state},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_returning_active_user_not_downgraded(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    # First login creates the user (pending_org_profile).
    fake_instagram.user_id = "ig_return_1"
    state = await _begin_login(app_client)
    await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c1", "state": state},
    )
    user = await db_session.scalar(select(User).where(User.instagram_user_id == "ig_return_1"))
    assert user is not None
    # Promote to active (simulating completed onboarding).
    user.status = "active"
    await db_session.commit()

    # Second login must NOT downgrade back to pending.
    state2 = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c2", "state": state2},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["user"]["status"] == "active"
