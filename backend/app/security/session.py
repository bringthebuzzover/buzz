"""Session revocation helpers (token_version bumps)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


def bump_token_version(user: User) -> int:
    """Invalidate outstanding Buzz JWTs for *user* by bumping ``token_version``.

    Returns the new version (always ≥ 1 after a bump from None/0).
    """

    user.token_version = (user.token_version or 0) + 1
    return user.token_version or 0


async def commit_revocation(db: AsyncSession) -> None:
    """Make a ``token_version`` bump durable before the HTTP response is sent.

    FastAPI delivers the body before ``get_db``'s yield-exit commit
    (auth.revocation-bump-uncommitted-until-teardown). Call once, after all
    ORM writes this request still needs. Do not call from ``issue_token_pair``
    (it has its own mint-last commit) and do not put a commit in
    ``bump_token_version`` (erase still writes after the bump).
    """

    await db.commit()
