"""Fernet symmetric encryption for Instagram tokens at rest.

The long-lived Instagram access token is encrypted before it touches the
database (architecture.md §10.5 / §11.1: "encrypted at rest"). The key comes
from ``settings.TOKEN_ENCRYPTION_KEY`` — a fixed dev default that MUST be
overridden in staging/production.

Stage 3 only *encrypts* (on the OAuth write path). Decryption is exercised by
the metric-sync / token-refresh jobs in Stage 8; ``decrypt_token`` is provided
here so those callers share one implementation.
"""

from __future__ import annotations

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


class TokenDecryptionError(Exception):
    """Raised when a stored ciphertext cannot be decrypted."""


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    return Fernet(settings.TOKEN_ENCRYPTION_KEY.encode("utf-8"))


def encrypt_token(plaintext: str) -> str:
    """Encrypt a token for storage; returns urlsafe-base64 ciphertext."""

    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a stored token; raises ``TokenDecryptionError`` if tampered."""

    try:
        return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise TokenDecryptionError("could not decrypt stored token") from exc
