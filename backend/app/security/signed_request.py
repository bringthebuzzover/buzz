"""Meta ``signed_request`` verification for Instagram webhook callbacks.

Meta signs the deauthorize / data-deletion webhook payloads with the app
secret and delivers them as ``signed_request = base64url(sig).base64url(json)``.
This module verifies the HMAC-SHA256 signature and returns the decoded payload
so route handlers stay a thin adapter.

The verifier is pure (takes the secret as an argument) so it's trivially
unit-testable; callers pass ``settings.INSTAGRAM_CLIENT_SECRET`` — the single
source of truth for the app secret.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
from typing import Any


class SignedRequestError(Exception):
    """Raised when a ``signed_request`` is malformed or fails HMAC verification."""


def _b64url_decode(segment: str) -> bytes:
    # Meta strips the base64 padding; add it back before decoding.
    padding = "=" * (-len(segment) % 4)
    try:
        return base64.urlsafe_b64decode(segment + padding)
    except (binascii.Error, ValueError) as exc:
        raise SignedRequestError("signed_request segment is not valid base64url") from exc


def parse_signed_request(signed_request: str, secret: str) -> dict[str, Any]:
    """Verify a Meta ``signed_request`` and return the decoded JSON payload.

    Raises :class:`SignedRequestError` if the shape is wrong, the algorithm is
    not HMAC-SHA256, or the signature does not match ``secret``. Signature
    comparison uses :func:`hmac.compare_digest` (constant-time).
    """

    if not signed_request or "." not in signed_request:
        raise SignedRequestError("signed_request must be '<sig>.<payload>'")

    encoded_sig, encoded_payload = signed_request.split(".", 1)
    sig = _b64url_decode(encoded_sig)

    expected = hmac.new(
        secret.encode("utf-8"), msg=encoded_payload.encode("utf-8"), digestmod=hashlib.sha256
    ).digest()
    if not hmac.compare_digest(sig, expected):
        raise SignedRequestError("signed_request signature mismatch")

    try:
        payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise SignedRequestError("signed_request payload is not valid JSON") from exc

    if not isinstance(payload, dict):
        raise SignedRequestError("signed_request payload must be a JSON object")

    algorithm = str(payload.get("algorithm", "")).upper()
    if algorithm != "HMAC-SHA256":
        raise SignedRequestError(f"unsupported signed_request algorithm: {algorithm!r}")

    return payload
