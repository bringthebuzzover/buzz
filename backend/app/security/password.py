"""Password hashing utilities for brand auth (architecture §4).

Uses bcrypt directly (passlib is unmaintained and incompatible with bcrypt >= 4.1).
"""

from __future__ import annotations

import bcrypt

# bcrypt only considers the first 72 bytes of the password and bcrypt >= 4.1
# *raises* on longer inputs (rather than silently truncating). We truncate to
# 72 bytes in both hash and verify so the two stay consistent and a long
# password can never surface as an uncaught 500.
_BCRYPT_MAX_BYTES = 72


def _encode(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    """Hash a plaintext password for storage in ``users.password_hash``."""
    return bcrypt.hashpw(_encode(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plaintext password against a stored bcrypt hash."""
    return bcrypt.checkpw(_encode(password), password_hash.encode("utf-8"))
