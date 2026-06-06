"""Admin routes — ``/api/admin`` (architecture.md §5.1, §8.5)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.auth import CurrentAdmin
from app.deps.db import get_db
from app.response import APIResponse, api_response
from app.schemas.admin import (
    AdminPendingBrandItem,
    AdminPendingOrgItem,
    TrackerAdvanceRequest,
)
from app.schemas.common import camelize
from app.services.admin import (
    advance_tracker,
    approve_brand,
    approve_org,
    deny_brand,
    deny_org,
    list_pending_brands,
    list_pending_orgs,
    reopen_drop,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/orgs/pending", response_model=APIResponse)
async def get_pending_orgs(
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_pending_orgs(db)
    return api_response(data=[AdminPendingOrgItem(**r) for r in rows])


@router.post("/orgs/{org_id}/approve", response_model=APIResponse)
async def approve_org_endpoint(
    org_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await approve_org(db, org_id)
    return api_response(data=camelize(result))


@router.post("/orgs/{org_id}/deny", response_model=APIResponse)
async def deny_org_endpoint(
    org_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await deny_org(db, org_id)
    return api_response(data=camelize(result))


@router.get("/brands/pending", response_model=APIResponse)
async def get_pending_brands(
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_pending_brands(db)
    return api_response(data=[AdminPendingBrandItem(**r) for r in rows])


@router.post("/brands/{brand_id}/approve", response_model=APIResponse)
async def approve_brand_endpoint(
    brand_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await approve_brand(db, brand_id)
    return api_response(data=camelize(result))


@router.post("/brands/{brand_id}/deny", response_model=APIResponse)
async def deny_brand_endpoint(
    brand_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await deny_brand(db, brand_id)
    return api_response(data=camelize(result))


@router.patch("/drops/{drop_id}/tracker", response_model=APIResponse)
async def advance_tracker_endpoint(
    drop_id: uuid.UUID,
    payload: TrackerAdvanceRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await advance_tracker(
        db, drop_id, payload.stage, tracking_number=payload.tracking_number, note=payload.note
    )
    return api_response(data=camelize(result))


@router.post("/drops/{drop_id}/reopen", response_model=APIResponse)
async def reopen_drop_endpoint(
    drop_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await reopen_drop(db, drop_id)
    return api_response(data=camelize(result))
