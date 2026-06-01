"""Drops routes — ``/api/drops`` (architecture.md §5.1).

Stage 4 ships the org browse feed read only (the first slice of the §5.2 drops
surface). Write paths (apply, create) land in Stage 5.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.auth import CurrentOrg
from app.deps.db import get_db
from app.response import APIResponse, api_response
from app.services.drops import list_org_drop_feed

router = APIRouter(prefix="/drops", tags=["drops"])


@router.get("", response_model=APIResponse)
async def list_drops(
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
) -> APIResponse:
    """Org drop browse feed (JWT + ``org`` role + ``active``)."""

    items, total = await list_org_drop_feed(db, user, page=page, per_page=per_page)
    return api_response(
        data=items,
        meta={"page": page, "per_page": per_page, "total": total},
    )
