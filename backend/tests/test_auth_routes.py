"""Integration tests for /me, /refresh, /logout (architecture.md §5.1, §5.3)."""

from __future__ import annotations

from httpx import AsyncClient

from app.config import settings
from app.models.enums import OrgUserStatus
from app.security import jwt
from tests.conftest import make_user, mint_access_token, mint_expired_access_token, persist

REFRESH = settings.REFRESH_COOKIE_NAME


async def test_me_valid(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    resp = await app_client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {mint_access_token(user)}"}
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == str(user.id)


async def test_me_missing_unauthorized(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/auth/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_me_expired_token_expired(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    resp = await app_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {mint_expired_access_token(user)}"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "TOKEN_EXPIRED"


async def test_me_refresh_token_rejected(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    refresh = jwt.create_refresh_token(user.id)
    resp = await app_client.get("/api/auth/me", headers={"Authorization": f"Bearer {refresh}"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_refresh_valid_cookie_rotates(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    refresh = jwt.create_refresh_token(user.id, token_version=user.token_version or 0)
    resp = await app_client.post("/api/auth/refresh", cookies={REFRESH: refresh})
    assert resp.status_code == 200
    assert resp.json()["data"]["access_token"]
    assert REFRESH in resp.headers.get("set-cookie", "")
    # Prior refresh cookie is dead after rotation (token_version bumped).
    resp2 = await app_client.post("/api/auth/refresh", cookies={REFRESH: refresh})
    assert resp2.status_code == 401


async def test_refresh_missing_cookie_unauthorized(app_client: AsyncClient) -> None:
    resp = await app_client.post("/api/auth/refresh")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"
    # Missing-cookie 401 must not emit Max-Age=0 (races concurrent login).
    set_cookie = resp.headers.get("set-cookie", "")
    assert REFRESH not in set_cookie


async def test_refresh_garbage_cookie_unauthorized(app_client: AsyncClient) -> None:
    resp = await app_client.post("/api/auth/refresh", cookies={REFRESH: "garbage"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"
    set_cookie = resp.headers.get("set-cookie", "")
    assert REFRESH in set_cookie
    assert "max-age=0" in set_cookie.lower() or "expires=thu, 01 jan 1970" in set_cookie.lower()


async def test_refresh_revoked_does_not_clear_cookie(
    app_client: AsyncClient, db_session
) -> None:
    """Superseded refresh must 401 without Max-Age=0.

    Clearing on ver mismatch races a concurrent refresh that just won rotation:
    the loser's Set-Cookie wipe lands after the winner's new cookie and kills
    the session (cold-nav / multi-tab flake class).
    """
    user = await persist(db_session, make_user())
    refresh = jwt.create_refresh_token(user.id, token_version=user.token_version or 0)
    user.token_version = (user.token_version or 0) + 1
    await db_session.flush()
    resp = await app_client.post("/api/auth/refresh", cookies={REFRESH: refresh})
    assert resp.status_code == 401
    set_cookie = resp.headers.get("set-cookie", "")
    assert REFRESH not in set_cookie


async def test_refresh_concurrent_loser_preserves_winner_cookie(
    app_client: AsyncClient, db_session
) -> None:
    """Winner rotates; loser with the old cookie must not wipe the jar."""
    user = await persist(db_session, make_user())
    old = jwt.create_refresh_token(user.id, token_version=user.token_version or 0)
    won = await app_client.post("/api/auth/refresh", cookies={REFRESH: old})
    assert won.status_code == 200
    new_cookie = won.cookies.get(REFRESH)
    assert new_cookie

    lost = await app_client.post("/api/auth/refresh", cookies={REFRESH: old})
    assert lost.status_code == 401
    assert REFRESH not in lost.headers.get("set-cookie", "")

    # Winner's cookie still refreshes (loser did not Max-Age=0 the jar).
    again = await app_client.post("/api/auth/refresh", cookies={REFRESH: new_cookie})
    assert again.status_code == 200
    assert again.json()["data"]["access_token"]


async def test_refresh_access_token_rejected(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    access = mint_access_token(user)
    resp = await app_client.post("/api/auth/refresh", cookies={REFRESH: access})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_refresh_denied_user_rejected(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user(status=OrgUserStatus.DENIED))
    refresh = jwt.create_refresh_token(user.id, token_version=user.token_version or 0)
    resp = await app_client.post("/api/auth/refresh", cookies={REFRESH: refresh})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_refresh_onboarding_user_allowed(app_client: AsyncClient, db_session) -> None:
    # Non-active onboarding users MUST still be able to refresh.
    user = await persist(db_session, make_user(status=OrgUserStatus.PENDING_ORG_PROFILE))
    refresh = jwt.create_refresh_token(user.id, token_version=user.token_version or 0)
    resp = await app_client.post("/api/auth/refresh", cookies={REFRESH: refresh})
    assert resp.status_code == 200
    assert resp.json()["data"]["access_token"]


async def test_logout_clears_cookie(app_client: AsyncClient) -> None:
    resp = await app_client.post("/api/auth/logout")
    assert resp.status_code == 200
    set_cookie = resp.headers.get("set-cookie", "")
    assert REFRESH in set_cookie
    assert "max-age=0" in set_cookie.lower() or "expires=thu, 01 jan 1970" in set_cookie.lower()


async def test_logout_with_bearer_bumps_without_cookie(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    access = mint_access_token(user)
    resp = await app_client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert resp.status_code == 200
    await db_session.refresh(user)
    assert user.token_version == 1
    # Old access is dead.
    me = await app_client.get("/api/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert me.status_code == 401


async def test_access_revoked_after_version_bump(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    access = mint_access_token(user)
    user.token_version = (user.token_version or 0) + 1
    await db_session.flush()
    resp = await app_client.get("/api/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"
