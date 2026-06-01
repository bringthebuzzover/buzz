"""Unit tests for the crypto primitives (no DB, no app)."""

from __future__ import annotations

import uuid
from datetime import timedelta

import jwt as pyjwt
import pytest

from app.config import settings
from app.security import jwt as buzz_jwt
from app.security.token_crypto import (
    TokenDecryptionError,
    decrypt_token,
    encrypt_token,
)


def test_access_token_round_trip_carries_role_and_status() -> None:
    uid = uuid.uuid4()
    token = buzz_jwt.create_access_token(uid, "org", "active")
    payload = buzz_jwt.decode_token(token, expected_type=buzz_jwt.ACCESS_TOKEN_TYPE)
    assert payload.sub == str(uid)
    assert payload.type == "access"
    assert payload.role == "org"
    assert payload.status == "active"


def test_refresh_token_round_trip() -> None:
    uid = uuid.uuid4()
    token = buzz_jwt.create_refresh_token(uid)
    payload = buzz_jwt.decode_token(token, expected_type=buzz_jwt.REFRESH_TOKEN_TYPE)
    assert payload.sub == str(uid)
    assert payload.type == "refresh"


def test_oauth_state_round_trip() -> None:
    token = buzz_jwt.create_oauth_state_token()
    payload = buzz_jwt.decode_token(token, expected_type=buzz_jwt.OAUTH_STATE_TOKEN_TYPE)
    assert payload.type == "oauth_state"
    assert payload.nonce


def test_refresh_token_rejected_as_access() -> None:
    token = buzz_jwt.create_refresh_token(uuid.uuid4())
    with pytest.raises(buzz_jwt.TokenInvalidError):
        buzz_jwt.decode_token(token, expected_type=buzz_jwt.ACCESS_TOKEN_TYPE)


def test_access_token_rejected_as_refresh() -> None:
    token = buzz_jwt.create_access_token(uuid.uuid4(), "org", "active")
    with pytest.raises(buzz_jwt.TokenInvalidError):
        buzz_jwt.decode_token(token, expected_type=buzz_jwt.REFRESH_TOKEN_TYPE)


def test_oauth_state_rejected_as_access_or_refresh() -> None:
    state = buzz_jwt.create_oauth_state_token()
    with pytest.raises(buzz_jwt.TokenInvalidError):
        buzz_jwt.decode_token(state, expected_type=buzz_jwt.ACCESS_TOKEN_TYPE)
    with pytest.raises(buzz_jwt.TokenInvalidError):
        buzz_jwt.decode_token(state, expected_type=buzz_jwt.REFRESH_TOKEN_TYPE)


def test_access_and_refresh_rejected_as_oauth_state() -> None:
    access = buzz_jwt.create_access_token(uuid.uuid4(), "org", "active")
    refresh = buzz_jwt.create_refresh_token(uuid.uuid4())
    with pytest.raises(buzz_jwt.TokenInvalidError):
        buzz_jwt.decode_token(access, expected_type=buzz_jwt.OAUTH_STATE_TOKEN_TYPE)
    with pytest.raises(buzz_jwt.TokenInvalidError):
        buzz_jwt.decode_token(refresh, expected_type=buzz_jwt.OAUTH_STATE_TOKEN_TYPE)


def test_tampered_signature_rejected() -> None:
    token = buzz_jwt.create_access_token(uuid.uuid4(), "org", "active")
    forged = pyjwt.encode({"sub": "x", "type": "access"}, "a-different-secret", algorithm="HS256")
    assert forged != token
    with pytest.raises(buzz_jwt.TokenInvalidError):
        buzz_jwt.decode_token(forged, expected_type=buzz_jwt.ACCESS_TOKEN_TYPE)


def test_expired_token_raises_expired_error() -> None:
    now = buzz_jwt._now()
    claims = {
        "sub": str(uuid.uuid4()),
        "type": "access",
        "iat": now - timedelta(hours=2),
        "exp": now - timedelta(hours=1),
        "jti": uuid.uuid4().hex,
    }
    expired = pyjwt.encode(claims, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    with pytest.raises(buzz_jwt.TokenExpiredError):
        buzz_jwt.decode_token(expired, expected_type=buzz_jwt.ACCESS_TOKEN_TYPE)


def test_token_encryption_round_trip() -> None:
    plaintext = "ig-long-lived-token-abc123"
    ciphertext = encrypt_token(plaintext)
    assert ciphertext != plaintext
    assert decrypt_token(ciphertext) == plaintext


def test_tampered_ciphertext_rejected() -> None:
    ciphertext = encrypt_token("secret")
    # Flip a character mid-token to break the HMAC while staying base64-shaped.
    idx = len(ciphertext) // 2
    swapped = "A" if ciphertext[idx] != "A" else "B"
    corrupted = ciphertext[:idx] + swapped + ciphertext[idx + 1 :]
    with pytest.raises(TokenDecryptionError):
        decrypt_token(corrupted)


def test_garbage_ciphertext_rejected() -> None:
    with pytest.raises(TokenDecryptionError):
        decrypt_token("not-a-valid-fernet-token")
