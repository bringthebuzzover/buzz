"""Admin routes — ``/api/admin`` (architecture.md §5.1, §8.5).

Reads are all ``GET`` and back the admin panel's sidebar sections. Mutations cover
account approve/deny/recovery, drop tracker/reopen/tracking repair, and
impersonation. Remaining stuck states without a product path stay in
``gaps/``.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps.auth import CurrentAdmin
from app.deps.db import get_db
from app.models.enums import BrandStatus, OrgUserStatus
from app.response import APIResponse, api_response
from app.schemas.admin import (
    AdminBrandDetail,
    AdminBrandItem,
    AdminCreateBrandRequest,
    AdminDropConfigPatch,
    AdminDropDetail,
    AdminDropItem,
    AdminHealthResponse,
    AdminOrgDetail,
    AdminOrgItem,
    AdminOverviewResponse,
    AdminPendingBrandItem,
    AdminPendingOrgItem,
    AdminUserItem,
    ImpersonateResponse,
    TrackerAdvanceRequest,
    TrackingRepairRequest,
)
from app.schemas.common import camelize
from app.services.admin import (
    advance_tracker,
    approve_brand,
    approve_org,
    clear_manual_reopen,
    clear_org_instagram_token,
    create_brand,
    deny_brand,
    deny_org,
    list_brands,
    list_orgs,
    reopen_drop,
    resend_brand_invite,
    set_drop_tracking_number,
    undeny_brand,
    undeny_org,
    update_drop_config,
)
from app.services.admin_auth import list_impersonatable_users, mint_impersonation_token
from app.services.admin_read import (
    get_brand_detail,
    get_drop_detail,
    get_health,
    get_org_detail,
    get_overview,
    list_drops,
)

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Overview + health ───────────────────────────────────────────────────────


@router.get("/overview", response_model=APIResponse)
async def get_overview_endpoint(
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Action-required queue counts plus any non-zero warning signals."""
    return api_response(data=AdminOverviewResponse(**await get_overview(db)))


@router.get("/health", response_model=APIResponse)
async def get_health_endpoint(
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Inferred pipeline freshness, Instagram token buckets, and standing
    integrity / silent-loss counts. See ``gaps/`` for why the pipeline
    block is inferred rather than measured."""
    return api_response(data=AdminHealthResponse(**await get_health(db)))


# ── Organizations ───────────────────────────────────────────────────────────


@router.get("/orgs", response_model=APIResponse)
async def list_orgs_endpoint(
    _user: CurrentAdmin,
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_orgs(db, status=status)
    return api_response(data=[AdminOrgItem(**r) for r in rows])


@router.get("/orgs/pending", response_model=APIResponse)
async def get_pending_orgs(
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_orgs(db, status=OrgUserStatus.PENDING_APPROVAL.value)
    # A pending-approval user always has a profile; the guard is a safety net so
    # the narrow schema's non-null fields can't blow up on bad data.
    return api_response(data=[AdminPendingOrgItem(**r) for r in rows if r["id"] is not None])


@router.get("/orgs/{user_id}", response_model=APIResponse)
async def get_org_detail_endpoint(
    user_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    return api_response(data=AdminOrgDetail(**await get_org_detail(db, user_id)))


@router.post("/orgs/{user_id}/clear-instagram-token", response_model=APIResponse)
async def clear_org_instagram_token_endpoint(
    user_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Clear an expired/stuck IG token so the org can authenticate again."""
    result = await clear_org_instagram_token(db, user_id)
    return api_response(data=camelize(result))


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


@router.post("/orgs/{org_id}/undeny", response_model=APIResponse)
async def undeny_org_endpoint(
    org_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await undeny_org(db, org_id)
    return api_response(data=camelize(result))


# ── Brands ──────────────────────────────────────────────────────────────────


@router.get("/brands", response_model=APIResponse)
async def list_brands_endpoint(
    _user: CurrentAdmin,
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_brands(db, status=status)
    return api_response(data=[AdminBrandItem(**r) for r in rows])


@router.get("/brands/pending", response_model=APIResponse)
async def get_pending_brands(
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_brands(db, status=BrandStatus.PENDING_REVIEW.value)
    return api_response(data=[AdminPendingBrandItem(**r) for r in rows])


@router.get("/brands/{brand_id}", response_model=APIResponse)
async def get_brand_detail_endpoint(
    brand_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    return api_response(data=AdminBrandDetail(**await get_brand_detail(db, brand_id)))


@router.post("/brands", response_model=APIResponse)
async def create_brand_endpoint(
    payload: AdminCreateBrandRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Provision a brand (and optionally approve + invite) when self-reg is off."""
    result = await create_brand(
        db,
        brand_name=payload.brand_name,
        company_email=payload.company_email,
        instagram_handle=payload.instagram_handle,
        intent_message=payload.intent_message,
        approve_now=payload.approve_now,
    )
    return api_response(data=camelize(result))


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


@router.post("/brands/{brand_id}/undeny", response_model=APIResponse)
async def undeny_brand_endpoint(
    brand_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await undeny_brand(db, brand_id)
    return api_response(data=camelize(result))


@router.post("/brands/{brand_id}/resend-invite", response_model=APIResponse)
async def resend_brand_invite_endpoint(
    brand_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await resend_brand_invite(db, brand_id)
    return api_response(data=camelize(result))


# ── Drops ───────────────────────────────────────────────────────────────────


@router.get("/drops", response_model=APIResponse)
async def list_drops_endpoint(
    _user: CurrentAdmin,
    stage: str | None = Query(default=None),
    attention: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_drops(db, stage=stage, attention=attention)
    return api_response(data=[AdminDropItem(**r) for r in rows])


@router.get("/drops/{drop_id}", response_model=APIResponse)
async def get_drop_detail_endpoint(
    drop_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    return api_response(data=AdminDropDetail(**await get_drop_detail(db, drop_id)))


@router.patch("/drops/{drop_id}", response_model=APIResponse)
async def patch_drop_config_endpoint(
    drop_id: uuid.UUID,
    payload: AdminDropConfigPatch,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    await update_drop_config(db, drop_id, payload)
    return api_response(data=AdminDropDetail(**await get_drop_detail(db, drop_id)))


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


@router.patch("/drops/{drop_id}/tracking", response_model=APIResponse)
async def set_drop_tracking_endpoint(
    drop_id: uuid.UUID,
    payload: TrackingRepairRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await set_drop_tracking_number(db, drop_id, payload.tracking_number)
    return api_response(data=camelize(result))


@router.post("/drops/{drop_id}/reopen", response_model=APIResponse)
async def reopen_drop_endpoint(
    drop_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await reopen_drop(db, drop_id)
    return api_response(data=camelize(result))


@router.post("/drops/{drop_id}/clear-reopen", response_model=APIResponse)
async def clear_reopen_endpoint(
    drop_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await clear_manual_reopen(db, drop_id)
    return api_response(data=camelize(result))


# ── Impersonation ───────────────────────────────────────────────────────────


@router.get("/users", response_model=APIResponse)
async def list_users_endpoint(
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Org + brand users for the admin impersonation picker."""
    rows = await list_impersonatable_users(db)
    return api_response(data=[AdminUserItem(**r) for r in rows])


@router.post("/impersonate/{user_id}", response_model=APIResponse)
async def impersonate_endpoint(
    user_id: uuid.UUID,
    user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Mint a short-lived access token that acts as ``user_id``.

    Intentionally does NOT set a refresh cookie: the admin's own refresh session
    must survive so exiting impersonation is a client-side token drop.
    """
    token, target = await mint_impersonation_token(db, user, user_id)
    return api_response(
        data=ImpersonateResponse(
            access_token=token,
            user=target,
            readonly=settings.IMPERSONATION_READONLY,
        )
    )
