"""The only place that reads ``META_REVIEWER_ACCESS_ENABLED``.

META-REVIEWER-PATH: delete this package to remove the feature. Callers
outside the package are listed in ``REMOVAL.md``.
"""

from __future__ import annotations

import hashlib
import hmac
import logging

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException
from app.models.user import User

logger = logging.getLogger(__name__)

REVIEWER_ORG_NAME = "Meta App Review"
DEFAULT_REVIEWER_ORG_EMAIL = "meta-app-reviewer@review.buzz.invalid"
_DUMMY_HASH = "0" * 64
_HEX = frozenset("0123456789abcdef")
_missing_hash_warned = False


def reviewer_access_enabled() -> bool:
    """True only when the operator has turned the temporary path on."""

    return bool(settings.META_REVIEWER_ACCESS_ENABLED)


def require_reviewer_access() -> None:
    """404 before any other reviewer work when the flag is off."""

    if not reviewer_access_enabled():
        raise BuzzAPIException(errors.NOT_FOUND, "Not found.", status_code=404)


def reviewer_org_email() -> str:
    raw = (settings.META_REVIEWER_ORG_EMAIL or "").strip().lower()
    return raw or DEFAULT_REVIEWER_ORG_EMAIL


def _configured_link_hash() -> str | None:
    """Return the 64-char hex digest, or None when it is unset or malformed."""

    global _missing_hash_warned
    raw = (settings.META_REVIEWER_LINK_SECRET_HASH or "").strip().lower()
    if len(raw) == 64 and all(char in _HEX for char in raw):
        return raw
    if reviewer_access_enabled() and not _missing_hash_warned:
        _missing_hash_warned = True
        logger.warning("meta reviewer link hash is unset or not 64 hex characters")
    return None


def link_secret_matches(presented: str) -> bool:
    """Constant-time compare of SHA-256(presented) to the configured hash.

    A missing or malformed hash never matches. ``presented`` is not logged.
    """

    expected = _configured_link_hash() or _DUMMY_HASH
    digest = hashlib.sha256(presented.encode("utf-8")).hexdigest()
    matched = hmac.compare_digest(digest, expected)
    return bool(matched and _configured_link_hash() is not None)


def reject_reviewer_mutation(user: User) -> None:
    """Block reviewer-org writes that are not own-post linking.

    No-op unless the flag is on and ``user`` is the configured reviewer org.
    Flag off does not read the database and does not change the response.
    """

    if not reviewer_access_enabled():
        return
    email = (user.edu_email or "").strip().lower()
    if email != reviewer_org_email():
        return
    raise BuzzAPIException(
        errors.FORBIDDEN,
        "This review account cannot change that.",
        status_code=403,
    )
