"""SHA-256 hashing for one-shot email tokens (invite, verify, password reset).

Raw tokens go in emails; only the hex digest is stored. Shared so invite /
verify match the password-reset pattern.
"""

from __future__ import annotations

import hashlib


def hash_token(raw: str) -> str:
    """Return the SHA-256 hex digest of a one-shot token string."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
