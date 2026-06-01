"""My-Campaigns routes — ``/api/campaigns`` (architecture.md §5.1, §7.2/§7.3).

Org-only. Denied applications are never returned (filtered from the list, 404
on detail). Returns all rows (no pagination) per §7.2.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.auth import CurrentOrg
from app.deps.db import get_db
from app.response import APIResponse, api_response
from app.services.campaigns import get_my_campaign, list_my_campaigns

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=APIResponse)
async def list_campaigns(
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """The caller org's campaigns (non-denied applications + joined drop)."""

    return api_response(data=await list_my_campaigns(db, user))


@router.get("/{application_id}", response_model=APIResponse)
async def campaign_detail(
    application_id: uuid.UUID,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """One campaign owned by the caller org (404 otherwise)."""

    return api_response(data=await get_my_campaign(db, user, application_id))
