"""Mint a known org apply prefill token (E2E helper).

    poetry run python scripts/mint_e2e_org_apply_prefill.py <raw> <edu> <handle>
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import delete

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.deps.db import async_session_factory  # noqa: E402
from app.models.org_apply_prefill import OrgApplyPrefill  # noqa: E402
from app.security.one_shot_tokens import hash_token  # noqa: E402
from app.services.org_apply_prefill_parse import PREFILL_TTL_DAYS  # noqa: E402


async def main(raw: str, edu_email: str, handle: str) -> None:
    digest = hash_token(raw)
    async with async_session_factory() as db:
        await db.execute(delete(OrgApplyPrefill).where(OrgApplyPrefill.token_hash == digest))
        db.add(
            OrgApplyPrefill(
                id=uuid4(),
                token_hash=digest,
                invite_email=edu_email,
                org_name="E2E Prefill Org",
                university="Cornell University",
                edu_email=edu_email,
                instagram_handle=handle,
                member_count=25,
                category="other",
                contact_name="E2E Prefill",
                shipping_line1="1 Campus Rd",
                shipping_city="Ithaca",
                shipping_state="NY",
                shipping_postal_code="14850",
                shipping_raw="1 Campus Rd, Ithaca, NY 14850",
                expires_at=datetime.now(timezone.utc) + timedelta(days=PREFILL_TTL_DAYS),
            )
        )
        await db.commit()
    print(raw)


if __name__ == "__main__":
    if len(sys.argv) < 4:
        raise SystemExit(
            "usage: mint_e2e_org_apply_prefill.py <raw_token> <edu_email> <handle>"
        )
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3]))
