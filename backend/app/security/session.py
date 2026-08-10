"""Session revocation helpers (token_version bumps)."""

from __future__ import annotations

from app.models.user import User


def bump_token_version(user: User) -> int:
    """Invalidate outstanding Buzz JWTs for *user* by bumping ``token_version``.

    Returns the new version (always ≥ 1 after a bump from None/0).
    """

    user.token_version = (user.token_version or 0) + 1
    return user.token_version or 0
