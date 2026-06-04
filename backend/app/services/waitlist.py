"""Public waitlist service (architecture.md §9.2)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.waitlist import Waitlist


async def submit_waitlist(
    db: AsyncSession,
    *,
    submitter_name: str,
    entity_name: str,
    email: str,
    entity_type: str,
    details: str | None = None,
) -> dict[str, Any]:
    """Insert a public waitlist entry (no deduplication)."""
    entry = Waitlist(
        id=uuid.uuid4(),
        submitter_name=submitter_name,
        entity_name=entity_name,
        email=email,
        entity_type=entity_type,
        details=details,
    )
    db.add(entry)
    await db.flush()
    return {"id": str(entry.id)}
