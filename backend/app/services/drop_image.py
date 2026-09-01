"""Shared validation for drop hero image URLs."""

from __future__ import annotations

from app import errors
from app.exceptions import BuzzAPIException


def validate_https_image(url: str) -> str:
    """Require https hero URLs; reject placehold.co placeholders."""
    value = url.strip()
    if not value.startswith("https://"):
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "image must be an https:// URL.",
            status_code=400,
        )
    lower = value.lower()
    if "placehold.co" in lower or "://placehold.co" in lower:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "placeholder images are not allowed; use a real https image URL.",
            status_code=400,
        )
    return value
