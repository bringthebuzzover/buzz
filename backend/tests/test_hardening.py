"""Stage 9 hardening: refresh-token revocation, rate limiting, admin gate,
security headers, prod config assertions (architecture §11.1)."""

from __future__ import annotations

import jwt as pyjwt
import pytest
from cryptography.fernet import Fernet
from httpx import AsyncClient

from app.config import Settings, settings
from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus, PortalRole
from app.security import jwt, rate_limit
from app.security.rate_limit import enforce_account_limit
from tests.conftest import make_user, mint_access_token, persist

REFRESH = settings.REFRESH_COOKIE_NAME


# --- Refresh-token revocation (token_version) --------------------------------


async def test_logout_revokes_outstanding_refresh_tokens(
    app_client: AsyncClient, db_session
) -> None:
    user = await persist(db_session, make_user())
    token = jwt.create_refresh_token(user.id, token_version=0)

    # logout bumps token_version -> the cookie's ver (0) no longer matches.
    resp = await app_client.post("/api/auth/logout", cookies={REFRESH: token})
    assert resp.status_code == 200
    await db_session.refresh(user)
    assert user.token_version == 1

    resp = await app_client.post("/api/auth/refresh", cookies={REFRESH: token})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_refresh_with_matching_version_succeeds(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())
    token = jwt.create_refresh_token(user.id, token_version=user.token_version or 0)
    resp = await app_client.post("/api/auth/refresh", cookies={REFRESH: token})
    assert resp.status_code == 200
    assert resp.json()["data"]["access_token"]


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
    resp = await app_client.post("/api/auth/refresh", cookies={REFRESH: legacy})
    assert resp.status_code == 200


async def test_logout_without_cookie_succeeds(app_client: AsyncClient) -> None:
    resp = await app_client.post("/api/auth/logout")
    assert resp.status_code == 200


async def test_logout_with_garbage_cookie_succeeds(app_client: AsyncClient) -> None:
    resp = await app_client.post("/api/auth/logout", cookies={REFRESH: "not-a-jwt"})
    assert resp.status_code == 200


# --- Rate limiting -----------------------------------------------------------


async def test_rate_limit_blocks_after_threshold(app_client: AsyncClient) -> None:
    settings.RATE_LIMIT_ENABLED = True
    rate_limit.reset()
    body = {"submitterName": "x", "entityName": "x", "email": "a@b.com", "entityType": "brand"}
    statuses = [(await app_client.post("/api/waitlist", json=body)).status_code for _ in range(6)]
    assert statuses[:5] == [200, 200, 200, 200, 200]
    assert statuses[5] == 429


async def test_rate_limit_disabled_does_not_block(app_client: AsyncClient) -> None:
    # autouse fixture leaves it disabled
    body = {"submitterName": "x", "entityName": "x", "email": "a@b.com", "entityType": "brand"}
    for _ in range(8):
        resp = await app_client.post("/api/waitlist", json=body)
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


async def test_suspended_admin_forbidden(app_client: AsyncClient, db_session) -> None:
    admin = await persist(
        db_session, make_user(role=PortalRole.ADMIN, status=OrgUserStatus.SUSPENDED)
    )
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
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(**_prod_kwargs(SECRET_KEY="dev-secret-change-me"))


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


def test_issue_token_pair_tolerates_unrefreshed_user() -> None:
    """A freshly-built user has token_version == None (server_default is DB-side);
    minting must coerce it to 0, not crash."""
    from app.services.auth import issue_token_pair

    user = make_user()
    assert user.token_version is None
    _access, refresh = issue_token_pair(user)
    payload = jwt.decode_token(refresh, expected_type=jwt.REFRESH_TOKEN_TYPE)
    assert payload.ver == 0


async def test_deny_org_revokes_sessions(app_client: AsyncClient, db_session) -> None:
    from tests.conftest import make_org

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

    def req(xff=None, host="9.9.9.9"):
        headers = {"x-forwarded-for": xff} if xff is not None else {}
        client = SimpleNamespace(host=host) if host is not None else None
        return SimpleNamespace(headers=headers, client=client)

    assert _client_ip(req(xff="1.2.3.4, 5.6.7.8")) == "1.2.3.4"  # first hop
    assert _client_ip(req(xff="  , 5.6.7.8")) == "9.9.9.9"  # empty first -> client
    assert _client_ip(req(xff=None)) == "9.9.9.9"  # no header -> client
    assert _client_ip(req(xff=None, host=None)) == "unknown"  # no client
