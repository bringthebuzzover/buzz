"""Stage 9 hardening: refresh-token revocation, rate limiting, admin gate,
security headers, prod config assertions (architecture §11.1)."""

from __future__ import annotations

import jwt as pyjwt
import pytest
from cryptography.fernet import Fernet
from httpx import AsyncClient
from pydantic import ValidationError

from app.config import (
    _DEV_SECRET_KEY,
    _DEV_TOKEN_ENCRYPTION_KEY,
    _FORBIDDEN_DEV_SECRET_KEYS,
    _HISTORICAL_DEV_SECRET_KEY,
    Settings,
    settings,
)
from app.exceptions import BuzzAPIException
from app.models.enums import BrandStatus, OrgUserStatus, PortalRole
from app.security import jwt, rate_limit
from app.security.rate_limit import enforce_account_limit
from tests.conftest import (
    make_brand,
    make_org,
    make_user,
    mint_access_token,
    persist,
    set_request_cookies,
)

REFRESH = settings.REFRESH_COOKIE_NAME


# --- Refresh-token revocation (token_version) --------------------------------


async def test_logout_revokes_outstanding_refresh_tokens(
    app_client: AsyncClient, db_session
) -> None:
    user = await persist(db_session, make_user())
    token = jwt.create_refresh_token(user.id, token_version=0)

    # logout bumps token_version -> the cookie's ver (0) no longer matches.
    set_request_cookies(app_client, {REFRESH: token})
    resp = await app_client.post("/api/auth/logout")
    assert resp.status_code == 200
    await db_session.refresh(user)
    assert user.token_version == 1

    set_request_cookies(app_client, {REFRESH: token})
    resp = await app_client.post("/api/auth/refresh")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_refresh_with_matching_version_succeeds(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    token = jwt.create_refresh_token(user.id, token_version=user.token_version or 0)
    set_request_cookies(app_client, {REFRESH: token})
    resp = await app_client.post("/api/auth/refresh")
    assert resp.status_code == 200
    assert resp.json()["data"]["access_token"]
    await db_session.refresh(user)
    assert user.token_version == 1
    # Old cookie no longer works after rotation bump.
    set_request_cookies(app_client, {REFRESH: token})
    resp2 = await app_client.post("/api/auth/refresh")
    assert resp2.status_code == 401


async def test_refresh_legacy_token_without_ver_claim_allowed(
    app_client: AsyncClient, db_session
) -> None:
    """A refresh token minted before token_version existed (no `ver` claim) must
    still work for a user at version 0 — no mass logout on deploy."""
    user = await persist(db_session, make_user())
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    legacy = pyjwt.encode(
        {
            "sub": str(user.id),
            "type": jwt.REFRESH_TOKEN_TYPE,
            "iat": now,
            "exp": now + timedelta(days=7),
            "jti": "legacy",
        },
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    set_request_cookies(app_client, {REFRESH: legacy})
    resp = await app_client.post("/api/auth/refresh")
    assert resp.status_code == 200
    await db_session.refresh(user)
    assert user.token_version == 1


async def test_logout_without_cookie_succeeds(app_client: AsyncClient) -> None:
    resp = await app_client.post("/api/auth/logout")
    assert resp.status_code == 200
    # Cookieless POST must not emit a Set-Cookie clear (cross-site CSRF jar).
    assert REFRESH not in resp.headers.get("set-cookie", "")


async def test_logout_with_garbage_cookie_clears_without_bump(
    app_client: AsyncClient,
) -> None:
    set_request_cookies(app_client, {REFRESH: "not-a-jwt"})
    resp = await app_client.post("/api/auth/logout")
    assert resp.status_code == 200
    set_cookie = resp.headers.get("set-cookie", "")
    assert REFRESH in set_cookie
    assert "max-age=0" in set_cookie.lower() or "expires=thu, 01 jan 1970" in set_cookie.lower()


async def test_logout_bearer_without_cookie_revokes_access(
    app_client: AsyncClient, db_session
) -> None:
    user = await persist(db_session, make_user())
    access = mint_access_token(user)
    resp = await app_client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert resp.status_code == 200
    await db_session.refresh(user)
    assert user.token_version == 1
    me = await app_client.get("/api/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert me.status_code == 401
    # Bump succeeded → clear cookie header even when none was sent.
    assert REFRESH in resp.headers.get("set-cookie", "")


# --- Rate limiting -----------------------------------------------------------


async def test_rate_limit_blocks_after_threshold(app_client: AsyncClient) -> None:
    settings.RATE_LIMIT_ENABLED = True
    settings.BRAND_SELF_REGISTRATION_ENABLED = True
    rate_limit.reset()
    statuses = [
        (
            await app_client.post(
                "/api/brands/apply",
                json={
                    "brandName": f"RL Brand {i}",
                    "companyEmail": f"rl-{i}@example.com",
                },
            )
        ).status_code
        for i in range(6)
    ]
    assert statuses[:5] == [200, 200, 200, 200, 200]
    assert statuses[5] == 429


async def test_rate_limit_disabled_does_not_block(app_client: AsyncClient) -> None:
    # autouse fixture leaves RATE_LIMIT_ENABLED disabled
    settings.BRAND_SELF_REGISTRATION_ENABLED = True
    for i in range(8):
        resp = await app_client.post(
            "/api/brands/apply",
            json={
                "brandName": f"RL Off Brand {i}",
                "companyEmail": f"rl-off-{i}@example.com",
            },
        )
        assert resp.status_code == 200


def test_enforce_account_limit_raises_over_cap() -> None:
    settings.RATE_LIMIT_ENABLED = True
    rate_limit.reset()
    for _ in range(20):
        enforce_account_limit("login", "x@y.com", limit=20, window=300)
    with pytest.raises(BuzzAPIException) as exc:
        enforce_account_limit("login", "x@y.com", limit=20, window=300)
    assert exc.value.status_code == 429


# --- Admin active-status gate ------------------------------------------------


async def test_inactive_admin_forbidden(app_client: AsyncClient, db_session) -> None:
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN, status=OrgUserStatus.DENIED))
    resp = await app_client.get(
        "/api/admin/orgs/pending",
        headers={"Authorization": f"Bearer {mint_access_token(admin)}"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


# --- Security headers --------------------------------------------------------


async def test_security_headers_present(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/health")
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert resp.headers["x-frame-options"] == "DENY"


async def test_openapi_available_in_development(app_client: AsyncClient) -> None:
    """Test suite runs with ENVIRONMENT=development; docs must stay on."""
    from app.main import _DOCS_ENABLED

    assert settings.ENVIRONMENT == "development"
    assert _DOCS_ENABLED is True
    resp = await app_client.get("/api/openapi.json")
    assert resp.status_code == 200
    assert "openapi" in resp.json()


def test_openapi_gated_off_development() -> None:
    """Off-dev FastAPI must not mount docs or openapi.json (404)."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    def _app(environment: str) -> FastAPI:
        enabled = environment == "development"
        return FastAPI(
            docs_url="/api/docs" if enabled else None,
            openapi_url="/api/openapi.json" if enabled else None,
        )

    with TestClient(_app("development")) as client:
        assert client.get("/api/openapi.json").status_code == 200
        assert client.get("/api/docs").status_code == 200

    with TestClient(_app("production")) as client:
        assert client.get("/api/openapi.json").status_code == 404
        assert client.get("/api/docs").status_code == 404


# --- Production config assertions --------------------------------------------


def _prod_kwargs(**over):
    base = dict(
        ENVIRONMENT="production",
        SECRET_KEY="real-secret",
        TOKEN_ENCRYPTION_KEY=Fernet.generate_key().decode(),
        REFRESH_COOKIE_SECURE=True,
        FRONTEND_URL="https://app.example.com",
        # Org login + transactional email are hard deps off-dev (§3.4, §4); the
        # validator now requires them, so the "valid" baseline must supply them.
        INSTAGRAM_CLIENT_ID="ig-client-id",
        INSTAGRAM_CLIENT_SECRET="ig-client-secret",
        INSTAGRAM_REDIRECT_URI="https://app.example.com/auth/instagram/callback",
        RESEND_API_KEY="re_test_key",
    )
    base.update(over)
    return base


def test_prod_config_valid() -> None:
    Settings(**_prod_kwargs())  # no raise


def test_prod_config_rejects_insecure_cookie() -> None:
    with pytest.raises(ValueError, match="REFRESH_COOKIE_SECURE"):
        Settings(**_prod_kwargs(REFRESH_COOKIE_SECURE=False))


def test_prod_config_rejects_localhost_frontend() -> None:
    with pytest.raises(ValueError, match="FRONTEND_URL"):
        Settings(**_prod_kwargs(FRONTEND_URL="http://localhost:3000"))


def test_prod_config_rejects_dev_secret() -> None:
    assert _HISTORICAL_DEV_SECRET_KEY in _FORBIDDEN_DEV_SECRET_KEYS
    assert _DEV_SECRET_KEY in _FORBIDDEN_DEV_SECRET_KEYS
    assert len(_DEV_SECRET_KEY.encode("utf-8")) >= 32
    for secret in _FORBIDDEN_DEV_SECRET_KEYS:
        with pytest.raises(ValueError, match="SECRET_KEY"):
            Settings(**_prod_kwargs(SECRET_KEY=secret))


def test_prod_config_rejects_dev_fernet_default() -> None:
    with pytest.raises(ValueError, match="TOKEN_ENCRYPTION_KEY"):
        Settings(**_prod_kwargs(TOKEN_ENCRYPTION_KEY=_DEV_TOKEN_ENCRYPTION_KEY))


def test_environment_rejects_unknown() -> None:
    with pytest.raises(ValidationError):
        Settings(**_prod_kwargs(ENVIRONMENT="prod"))  # type: ignore[arg-type]


def test_prod_config_rejects_missing_instagram_creds() -> None:
    with pytest.raises(ValueError, match="INSTAGRAM_CLIENT_ID"):
        Settings(**_prod_kwargs(INSTAGRAM_CLIENT_ID=""))


def test_prod_config_rejects_missing_resend_key() -> None:
    with pytest.raises(ValueError, match="RESEND_API_KEY"):
        Settings(**_prod_kwargs(RESEND_API_KEY=""))


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (
            "postgres://user:pass@host:5432/buzz",
            "postgresql+asyncpg://user:pass@host:5432/buzz",
        ),
        (
            "postgresql://user:pass@host:5432/buzz",
            "postgresql+asyncpg://user:pass@host:5432/buzz",
        ),
        (
            "postgresql+asyncpg://user:pass@host:5432/buzz",
            "postgresql+asyncpg://user:pass@host:5432/buzz",
        ),
    ],
)
def test_database_url_normalized_to_asyncpg(raw: str, expected: str) -> None:
    cfg = Settings(**_prod_kwargs(DATABASE_URL=raw))
    assert cfg.DATABASE_URL == expected


# --- Edge cases surfaced by review -------------------------------------------


async def test_issue_token_pair_bumps_unrefreshed_user(db_session) -> None:
    """A freshly-built user has token_version == None (server_default is DB-side);
    minting bumps to 1 and stamps that on both tokens."""
    from app.services.auth import issue_token_pair

    user = await persist(db_session, make_user())
    # Simulate an in-memory object that has not seen the server default yet.
    user.token_version = None  # type: ignore[assignment]
    access, refresh = await issue_token_pair(db_session, user)
    assert user.token_version == 1
    refresh_payload = jwt.decode_token(refresh, expected_type=jwt.REFRESH_TOKEN_TYPE)
    access_payload = jwt.decode_token(access, expected_type=jwt.ACCESS_TOKEN_TYPE)
    assert refresh_payload.ver == 1
    assert access_payload.ver == 1


async def test_issue_token_pair_second_mint_sees_prior_bump(db_session) -> None:
    """Reload-for-update must mint strictly increasing vers, not two of the same."""
    from app.services.auth import issue_token_pair

    user = await persist(db_session, make_user())
    start = user.token_version or 0
    access1, refresh1 = await issue_token_pair(db_session, user)
    access2, refresh2 = await issue_token_pair(db_session, user)
    assert user.token_version == start + 2
    a1 = jwt.decode_token(access1, expected_type=jwt.ACCESS_TOKEN_TYPE)
    a2 = jwt.decode_token(access2, expected_type=jwt.ACCESS_TOKEN_TYPE)
    r1 = jwt.decode_token(refresh1, expected_type=jwt.REFRESH_TOKEN_TYPE)
    r2 = jwt.decode_token(refresh2, expected_type=jwt.REFRESH_TOKEN_TYPE)
    assert a1.ver == start + 1
    assert a2.ver == start + 2
    assert r1.ver == a1.ver
    assert r2.ver == a2.ver


async def test_issue_token_pair_commits_the_bump(db_session, monkeypatch) -> None:
    """The bump must be durable before the caller builds its response.

    FastAPI sends the response before ``get_db``'s exit-code commit runs, so a
    client that immediately presents the token it was just handed would be
    checked against the un-bumped row and read as revoked
    (auth.mint-bump-not-durable-before-response).
    """
    from app.services.auth import issue_token_pair

    user = await persist(db_session, make_user())
    commits: list[int] = []
    original = db_session.commit

    async def spy() -> None:
        commits.append(1)
        await original()

    monkeypatch.setattr(db_session, "commit", spy)
    await issue_token_pair(db_session, user)
    assert commits, "issue_token_pair must commit the token_version bump itself"


async def test_issue_token_pair_stale_expected_version_does_not_bump(db_session) -> None:
    """A superseded refresh must not bump after losing the row lock."""
    from app.services.auth import StaleRefreshToken, issue_token_pair

    user = await persist(db_session, make_user())
    start = user.token_version or 0
    await issue_token_pair(db_session, user)
    assert user.token_version == start + 1
    with pytest.raises(StaleRefreshToken):
        await issue_token_pair(db_session, user, expected_version=start)
    assert user.token_version == start + 1


async def test_issue_token_pair_matching_expected_version_still_bumps(db_session) -> None:
    from app.services.auth import issue_token_pair

    user = await persist(db_session, make_user())
    start = user.token_version or 0
    await issue_token_pair(db_session, user, expected_version=start)
    assert user.token_version == start + 1


async def test_deny_org_revokes_sessions(app_client: AsyncClient, db_session) -> None:
    org_user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_APPROVAL, instagram_user_id="ig_deny"),
    )
    org = await make_org(db_session, org_user)
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))

    resp = await app_client.post(
        f"/api/admin/orgs/{org.id}/deny",
        headers={"Authorization": f"Bearer {mint_access_token(admin)}"},
    )
    assert resp.status_code == 200
    await db_session.refresh(org_user)
    assert org_user.token_version == 1


def _spy_commits(db_session, monkeypatch) -> list[int]:
    commits: list[int] = []
    original = db_session.commit

    async def spy() -> None:
        commits.append(1)
        await original()

    monkeypatch.setattr(db_session, "commit", spy)
    return commits


async def test_logout_commits_the_bump(app_client: AsyncClient, db_session, monkeypatch) -> None:
    user = await persist(db_session, make_user())
    access = mint_access_token(user)
    commits = _spy_commits(db_session, monkeypatch)
    resp = await app_client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert resp.status_code == 200
    assert commits, "logout must commit the token_version bump itself"


async def test_reset_password_commits_the_bump(db_session, monkeypatch) -> None:
    import uuid
    from datetime import datetime, timedelta, timezone

    from app.models.password_reset_token import PasswordResetToken
    from app.security.one_shot_tokens import hash_token
    from app.security.password import hash_password
    from app.services.password_reset import reset_password

    user = await persist(db_session, make_user(role=PortalRole.BRAND))
    user.password_hash = hash_password("old-password-9")
    raw = "reset-commit-token"
    db_session.add(
        PasswordResetToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=hash_token(raw),
            email="reset-commit@brand.test",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    )
    await db_session.flush()
    commits = _spy_commits(db_session, monkeypatch)
    result = await reset_password(db_session, portal="brand", token=raw, password="new-password-9")
    assert result["ok"] is True
    assert commits, "reset_password must commit the token_version bump itself"


async def test_deny_org_commits_the_bump(db_session, monkeypatch) -> None:
    from app.services.admin import deny_org

    org_user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_APPROVAL, instagram_user_id="ig_deny_commit"),
    )
    org = await make_org(db_session, org_user)
    commits = _spy_commits(db_session, monkeypatch)
    await deny_org(db_session, org.id)
    assert commits, "deny_org must commit the token_version bump itself"


async def test_deny_brand_commits_the_bump(db_session, monkeypatch) -> None:
    from app.models.user import User
    from app.services.admin import deny_brand

    brand = await make_brand(db_session, brand_name="Deny Commit Brand")
    brand.status = BrandStatus.PENDING_REVIEW.value
    user = await db_session.get(User, brand.user_id)
    assert user is not None
    user.status = OrgUserStatus.PENDING_APPROVAL.value
    await db_session.flush()
    commits = _spy_commits(db_session, monkeypatch)
    await deny_brand(db_session, brand.id)
    assert commits, "deny_brand must commit the token_version bump itself"
    await db_session.refresh(user)
    assert user.token_version == 1


async def test_deauthorize_commits_the_bump(db_session, monkeypatch) -> None:
    from app.services.auth import revoke_instagram_authorization

    await persist(db_session, make_user(instagram_user_id="ig_deauth_commit"))
    commits = _spy_commits(db_session, monkeypatch)
    assert await revoke_instagram_authorization(db_session, "ig_deauth_commit")
    assert commits, "deauthorize must commit the token_version bump itself"


async def test_clear_org_instagram_token_commits_the_bump(db_session, monkeypatch) -> None:
    from app.services.admin import clear_org_instagram_token

    user = await persist(db_session, make_user(instagram_user_id="ig_clear_commit"))
    commits = _spy_commits(db_session, monkeypatch)
    await clear_org_instagram_token(db_session, user.id)
    assert commits, "clear_org_instagram_token must commit the token_version bump itself"


async def test_security_headers_on_error_response(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/does-not-exist")
    assert resp.status_code == 404
    assert resp.headers["x-content-type-options"] == "nosniff"


def test_rate_limit_buckets_hard_ceiling() -> None:
    """A flood of distinct fresh keys must not grow _buckets without bound: the
    hard ceiling evicts oldest entries so memory stays capped."""
    from app.security import rate_limit as rl

    rate_limit.reset()
    settings.RATE_LIMIT_ENABLED = True
    try:
        for i in range(rl._MAX_BUCKETS + 500):
            rl._allowed(f"flood:{i}", limit=1, window=300)
        assert len(rl._buckets) <= rl._MAX_BUCKETS
    finally:
        rate_limit.reset()


def test_client_ip_parsing() -> None:
    from types import SimpleNamespace

    from app.security.rate_limit import _client_ip

    def req(*, real_ip=None, xff=None, host="9.9.9.9"):
        headers: dict[str, str] = {}
        if real_ip is not None:
            headers["x-real-ip"] = real_ip
        if xff is not None:
            headers["x-forwarded-for"] = xff
        client = SimpleNamespace(host=host) if host is not None else None
        return SimpleNamespace(headers=headers, client=client)

    # Spoofed XFF must not change the bucket key.
    assert _client_ip(req(xff="1.2.3.4, 5.6.7.8")) == "9.9.9.9"
    # Railway X-Real-IP is trusted when present.
    assert _client_ip(req(real_ip="10.0.0.1", xff="1.2.3.4")) == "10.0.0.1"
    assert _client_ip(req()) == "9.9.9.9"
    assert _client_ip(req(host=None)) == "unknown"
