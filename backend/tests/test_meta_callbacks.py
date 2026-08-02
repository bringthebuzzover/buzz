"""Meta webhook callbacks: signed_request parsing + deauthorize endpoint.

Covers both the pure verifier (`parse_signed_request`) and the public
`POST /api/auth/instagram/deauthorize` route. Uses the standard
`app_client` / `db_session` fixtures so the route runs against the rolled-back
test transaction, and builds the `signed_request` payload against the same
`INSTAGRAM_CLIENT_SECRET` the route reads (single source of truth).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.config import settings
from app.models.enums import OrgUserStatus, PortalRole
from app.models.user import User
from app.security.signed_request import (
    SignedRequestError,
    parse_signed_request,
)
from tests.conftest import make_user, persist


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _build_signed_request(payload: dict, secret: str) -> str:
    """Build a valid Meta-style ``signed_request`` for a given payload/secret."""

    encoded_payload = _b64url_encode(json.dumps(payload).encode("utf-8"))
    sig = hmac.new(secret.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256).digest()
    return f"{_b64url_encode(sig)}.{encoded_payload}"


# ── Unit tests: parse_signed_request ────────────────────────────────────────


def test_parse_signed_request_roundtrip() -> None:
    secret = "test-secret"
    payload = {"algorithm": "HMAC-SHA256", "user_id": "ig_42", "issued_at": 1_700_000_000}
    signed = _build_signed_request(payload, secret)

    assert parse_signed_request(signed, secret) == payload


def test_parse_signed_request_rejects_bad_signature() -> None:
    signed = _build_signed_request({"algorithm": "HMAC-SHA256", "user_id": "x"}, "right")
    with pytest.raises(SignedRequestError, match="signature mismatch"):
        parse_signed_request(signed, "wrong")


def test_parse_signed_request_rejects_missing_dot() -> None:
    with pytest.raises(SignedRequestError, match="<sig>.<payload>"):
        parse_signed_request("no-dot-here", "secret")


def test_parse_signed_request_rejects_wrong_algorithm() -> None:
    signed = _build_signed_request({"algorithm": "PLAINTEXT", "user_id": "x"}, "s")
    with pytest.raises(SignedRequestError, match="unsupported"):
        parse_signed_request(signed, "s")


def test_parse_signed_request_rejects_non_object_payload() -> None:
    encoded = _b64url_encode(json.dumps(["not", "an", "object"]).encode("utf-8"))
    sig = hmac.new(b"s", encoded.encode("ascii"), hashlib.sha256).digest()
    signed = f"{_b64url_encode(sig)}.{encoded}"
    with pytest.raises(SignedRequestError, match="JSON object"):
        parse_signed_request(signed, "s")


# ── Integration: /api/auth/instagram/deauthorize ────────────────────────────


async def _seed_org_user_with_token(db_session, *, instagram_user_id: str) -> User:
    user = make_user(
        role=PortalRole.ORG,
        status=OrgUserStatus.ACTIVE,
        instagram_user_id=instagram_user_id,
    )
    now = datetime.now(timezone.utc)
    user.instagram_access_token = "encrypted-blob"
    user.instagram_token_issued_at = now
    user.instagram_token_expires_at = now
    user.instagram_token_refreshed_at = now
    user.token_version = 3
    await persist(db_session, user)
    return user


async def test_deauthorize_clears_token_and_bumps_version(
    app_client: AsyncClient, db_session
) -> None:
    user = await _seed_org_user_with_token(db_session, instagram_user_id="ig_deauth_1")
    signed = _build_signed_request(
        {"algorithm": "HMAC-SHA256", "user_id": "ig_deauth_1"},
        settings.INSTAGRAM_CLIENT_SECRET,
    )

    resp = await app_client.post(
        "/api/auth/instagram/deauthorize",
        data={"signed_request": signed},
    )

    assert resp.status_code == 200
    assert resp.json()["data"] == {"ok": True}

    await db_session.refresh(user)
    assert user.instagram_access_token is None
    assert user.instagram_token_issued_at is None
    assert user.instagram_token_expires_at is None
    assert user.instagram_token_refreshed_at is None
    assert user.token_version == 4  # bumped from 3


async def test_deauthorize_unknown_user_is_idempotent(app_client: AsyncClient, db_session) -> None:
    signed = _build_signed_request(
        {"algorithm": "HMAC-SHA256", "user_id": "ig_never_seen"},
        settings.INSTAGRAM_CLIENT_SECRET,
    )

    resp = await app_client.post(
        "/api/auth/instagram/deauthorize",
        data={"signed_request": signed},
    )

    assert resp.status_code == 200
    assert resp.json()["data"] == {"ok": True}
    # And no phantom user was created.
    row = await db_session.scalar(select(User).where(User.instagram_user_id == "ig_never_seen"))
    assert row is None


async def test_deauthorize_bad_signature_is_unauthorized(
    app_client: AsyncClient, db_session
) -> None:
    user = await _seed_org_user_with_token(db_session, instagram_user_id="ig_deauth_2")
    signed = _build_signed_request(
        {"algorithm": "HMAC-SHA256", "user_id": "ig_deauth_2"},
        "not-the-real-secret",
    )

    resp = await app_client.post(
        "/api/auth/instagram/deauthorize",
        data={"signed_request": signed},
    )

    assert resp.status_code == 401
    body = resp.json()
    assert body["error"]["code"] == "UNAUTHORIZED"

    # Token untouched.
    await db_session.refresh(user)
    assert user.instagram_access_token == "encrypted-blob"
    assert user.token_version == 3


async def test_deauthorize_missing_field_is_validation_error(
    app_client: AsyncClient,
) -> None:
    resp = await app_client.post("/api/auth/instagram/deauthorize", data={})

    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
