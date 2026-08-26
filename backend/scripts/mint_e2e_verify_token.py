"""Mint a known email-verification token for an edu email (E2E helper).

Usage::

    poetry run python scripts/mint_e2e_verify_token.py user@cornell.edu [raw-token]

Prints the raw token to stdout.
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import select

from app.config import settings
from app.deps.db import async_session_factory
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.security.one_shot_tokens import hash_token
from app.services.onboarding import _invalidate_verification_tokens


async def main(edu_email: str, raw: str) -> None:
    async with async_session_factory() as db:
        user = await db.scalar(select(User).where(User.edu_email == edu_email.lower()))
        if user is None:
            raise SystemExit(f"no user with edu_email={edu_email!r}")
        await _invalidate_verification_tokens(db, user.id)
        db.add(
            EmailVerificationToken(
                id=uuid4(),
                user_id=user.id,
                token_hash=hash_token(raw),
                email=user.edu_email,
                expires_at=datetime.now(timezone.utc)
                + timedelta(hours=settings.VERIFICATION_TOKEN_TTL_HOURS),
            )
        )
        await db.commit()
    print(raw)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: mint_e2e_verify_token.py <edu_email> [raw_token]")
    email = sys.argv[1]
    token = sys.argv[2] if len(sys.argv) > 2 else "e2e-org-apply-verify-token"
    asyncio.run(main(email, token))
