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
from app.response import APIResponse, DataResponse, api_response
from app.schemas.acks import (
    AdminBrandInviteResponse,
    AdminBrandStatusResponse,
    AdminOrgEraseRequest,
    AdminOrgEraseResponse,
    AdminOrgStatusResponse,
    ClearInstagramTokenResponse,
    DropReopenResponse,
    DropTrackingResponse,
    TrackerAdvanceResponse,
)
from app.schemas.admin import (
    AdminBrandDetail,
    AdminBrandItem,
    AdminCleanupStubsResponse,
    AdminCreateBrandRequest,
    AdminDropConfigPatch,
    AdminDropCreateRequest,
    AdminDropDetail,
    AdminDropItem,
    AdminDropRequestItem,
    AdminHealthResponse,
    AdminOrgApproveRequest,
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
from app.services.admin import (
    advance_tracker,
    approve_brand,
    approve_org,
    cleanup_request_received_stubs,
    clear_manual_reopen,
    clear_org_instagram_token,
    create_admin_drop,
    create_brand,
    deny_brand,
    deny_org,
    list_brands,
    list_orgs,
    publish_drop,
    reopen_drop,
    resend_brand_invite,
    resend_org_connect,
    set_drop_tracking_number,
    undeny_brand,
    undeny_org,
    update_drop_config,
)
from app.services.admin_auth import list_impersonatable_users, mint_impersonation_token
from app.services.admin_erase import erase_org_user
from app.services.admin_read import (
    get_brand_detail,
    get_drop_detail,
    get_health,
    get_org_detail,
    get_overview,
    list_drops,
)
from app.services.drop_requests import get_admin_drop_request, list_admin_drop_requests

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Overview + health ───────────────────────────────────────────────────────


@router.get("/overview", response_model=DataResponse[AdminOverviewResponse])
async def get_overview_endpoint(
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Action-required queue counts plus any non-zero warning signals."""
    return api_response(data=AdminOverviewResponse(**await get_overview(db)))


@router.get("/health", response_model=DataResponse[AdminHealthResponse])
async def get_health_endpoint(
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Inferred pipeline freshness, Instagram token buckets, and standing
    integrity / silent-loss counts. See ``gaps/`` for why the pipeline
    block is inferred rather than measured."""
    return api_response(data=AdminHealthResponse(**await get_health(db)))


# ── Organizations ───────────────────────────────────────────────────────────


@router.get("/orgs", response_model=DataResponse[list[AdminOrgItem]])
async def list_orgs_endpoint(
    _user: CurrentAdmin,
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_orgs(db, status=status)
    return api_response(data=[AdminOrgItem(**r) for r in rows])


@router.get("/orgs/pending", response_model=DataResponse[list[AdminPendingOrgItem]])
async def get_pending_orgs(
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_orgs(db, status=OrgUserStatus.PENDING_APPROVAL.value)
    # A pending-approval user always has a profile; the guard is a safety net so
    # the narrow schema's non-null fields can't blow up on bad data.
    return api_response(data=[AdminPendingOrgItem(**r) for r in rows if r["id"] is not None])


@router.get("/orgs/{user_id}", response_model=DataResponse[AdminOrgDetail])
async def get_org_detail_endpoint(
    user_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    return api_response(data=AdminOrgDetail(**await get_org_detail(db, user_id)))


@router.post(
    "/orgs/{user_id}/clear-instagram-token",
    response_model=DataResponse[ClearInstagramTokenResponse],
)
async def clear_org_instagram_token_endpoint(
    user_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Clear an expired/stuck IG token so the org can authenticate again."""
    result = await clear_org_instagram_token(db, user_id)
    return api_response(data=ClearInstagramTokenResponse.model_validate(result))


@router.post(
    "/orgs/{user_id}/erase",
    response_model=DataResponse[AdminOrgEraseResponse],
)
async def erase_org_endpoint(
    user_id: uuid.UUID,
    body: AdminOrgEraseRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Hybrid erase: scrub identity/PII; keep campaign KPIs (PRODUCT §3.1.2 / §4.3)."""
    result = await erase_org_user(db, user_id, body.confirm)
    return api_response(data=AdminOrgEraseResponse.model_validate(result))


@router.post("/orgs/{org_id}/approve", response_model=DataResponse[AdminOrgStatusResponse])
async def approve_org_endpoint(
    org_id: uuid.UUID,
    payload: AdminOrgApproveRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await approve_org(db, org_id, tester_invite_confirmed=payload.tester_invite_confirmed)
    return api_response(data=AdminOrgStatusResponse.model_validate(result))


@router.post(
    "/orgs/{org_id}/resend-connect",
    response_model=DataResponse[AdminOrgStatusResponse],
)
async def resend_org_connect_endpoint(
    org_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await resend_org_connect(db, org_id)
    return api_response(data=AdminOrgStatusResponse.model_validate(result))


@router.post("/orgs/{org_id}/deny", response_model=DataResponse[AdminOrgStatusResponse])
async def deny_org_endpoint(
    org_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await deny_org(db, org_id)
    return api_response(data=AdminOrgStatusResponse.model_validate(result))


@router.post("/orgs/{org_id}/undeny", response_model=DataResponse[AdminOrgStatusResponse])
async def undeny_org_endpoint(
    org_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await undeny_org(db, org_id)
    return api_response(data=AdminOrgStatusResponse.model_validate(result))


# ── Brands ──────────────────────────────────────────────────────────────────


@router.get("/brands", response_model=DataResponse[list[AdminBrandItem]])
async def list_brands_endpoint(
    _user: CurrentAdmin,
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_brands(db, status=status)
    return api_response(data=[AdminBrandItem(**r) for r in rows])


@router.get("/brands/pending", response_model=DataResponse[list[AdminPendingBrandItem]])
async def get_pending_brands(
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_brands(db, status=BrandStatus.PENDING_REVIEW.value)
    return api_response(data=[AdminPendingBrandItem(**r) for r in rows])


@router.get("/brands/{brand_id}", response_model=DataResponse[AdminBrandDetail])
async def get_brand_detail_endpoint(
    brand_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    return api_response(data=AdminBrandDetail(**await get_brand_detail(db, brand_id)))


@router.post("/brands", response_model=DataResponse[AdminBrandInviteResponse])
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
    return api_response(data=AdminBrandInviteResponse.model_validate(result))


@router.post("/brands/{brand_id}/approve", response_model=DataResponse[AdminBrandInviteResponse])
async def approve_brand_endpoint(
    brand_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await approve_brand(db, brand_id)
    return api_response(data=AdminBrandInviteResponse.model_validate(result))


@router.post("/brands/{brand_id}/deny", response_model=DataResponse[AdminBrandStatusResponse])
async def deny_brand_endpoint(
    brand_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await deny_brand(db, brand_id)
    return api_response(data=AdminBrandStatusResponse.model_validate(result))


@router.post("/brands/{brand_id}/undeny", response_model=DataResponse[AdminBrandStatusResponse])
async def undeny_brand_endpoint(
    brand_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await undeny_brand(db, brand_id)
    return api_response(data=AdminBrandStatusResponse.model_validate(result))


@router.post(
    "/brands/{brand_id}/resend-invite", response_model=DataResponse[AdminBrandInviteResponse]
)
async def resend_brand_invite_endpoint(
    brand_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await resend_brand_invite(db, brand_id)
    return api_response(data=AdminBrandInviteResponse.model_validate(result))


# ── Drop requests (intake tickets) ───────────────────────────────────────────


@router.get(
    "/drop-requests",
    response_model=DataResponse[list[AdminDropRequestItem]],
)
async def list_drop_requests_endpoint(
    _user: CurrentAdmin,
    status: str | None = Query(default=None),
    brand_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_admin_drop_requests(db, status=status, brand_id=brand_id)
    return api_response(
        data=[
            AdminDropRequestItem(
                id=ticket.id,
                brand_id=ticket.brand_id,
                brand_name=brand.brand_name,
                message=ticket.message,
                notes=ticket.notes,
                status=ticket.status,
                converted_drop_id=ticket.converted_drop_id,
                created_at=ticket.created_at,
                updated_at=ticket.updated_at,
            )
            for ticket, brand in rows
        ]
    )


@router.get(
    "/drop-requests/{request_id}",
    response_model=DataResponse[AdminDropRequestItem],
)
async def get_drop_request_endpoint(
    request_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    ticket, brand = await get_admin_drop_request(db, request_id)
    return api_response(
        data=AdminDropRequestItem(
            id=ticket.id,
            brand_id=ticket.brand_id,
            brand_name=brand.brand_name,
            message=ticket.message,
            notes=ticket.notes,
            status=ticket.status,
            converted_drop_id=ticket.converted_drop_id,
            created_at=ticket.created_at,
            updated_at=ticket.updated_at,
        )
    )


# ── Drops ───────────────────────────────────────────────────────────────────


@router.get("/drops", response_model=DataResponse[list[AdminDropItem]])
async def list_drops_endpoint(
    _user: CurrentAdmin,
    stage: list[str] | None = Query(default=None),
    attention: list[str] | None = Query(default=None),
    published: str | None = Query(default=None, pattern="^(draft|published)$"),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_drops(db, stage=stage, attention=attention, published=published)
    return api_response(data=[AdminDropItem(**r) for r in rows])


@router.get("/drops/{drop_id}", response_model=DataResponse[AdminDropDetail])
async def get_drop_detail_endpoint(
    drop_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    return api_response(data=AdminDropDetail(**await get_drop_detail(db, drop_id)))


@router.post(
    "/brands/{brand_id}/drops",
    response_model=DataResponse[AdminDropDetail],
)
async def create_admin_drop_endpoint(
    brand_id: uuid.UUID,
    payload: AdminDropCreateRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    drop = await create_admin_drop(db, brand_id, payload)
    return api_response(data=AdminDropDetail(**await get_drop_detail(db, drop.id)))


@router.post(
    "/drops/{drop_id}/publish",
    response_model=DataResponse[AdminDropDetail],
)
async def publish_drop_endpoint(
    drop_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    await publish_drop(db, drop_id)
    return api_response(data=AdminDropDetail(**await get_drop_detail(db, drop_id)))


@router.patch("/drops/{drop_id}", response_model=DataResponse[AdminDropDetail])
async def patch_drop_config_endpoint(
    drop_id: uuid.UUID,
    payload: AdminDropConfigPatch,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    await update_drop_config(db, drop_id, payload)
    return api_response(data=AdminDropDetail(**await get_drop_detail(db, drop_id)))


@router.patch("/drops/{drop_id}/tracker", response_model=DataResponse[TrackerAdvanceResponse])
async def advance_tracker_endpoint(
    drop_id: uuid.UUID,
    payload: TrackerAdvanceRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await advance_tracker(
        db, drop_id, payload.stage, tracking_number=payload.tracking_number, note=payload.note
    )
    return api_response(data=TrackerAdvanceResponse.model_validate(result))


@router.patch("/drops/{drop_id}/tracking", response_model=DataResponse[DropTrackingResponse])
async def set_drop_tracking_endpoint(
    drop_id: uuid.UUID,
    payload: TrackingRepairRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await set_drop_tracking_number(db, drop_id, payload.tracking_number)
    return api_response(data=DropTrackingResponse.model_validate(result))


@router.post("/drops/{drop_id}/reopen", response_model=DataResponse[DropReopenResponse])
async def reopen_drop_endpoint(
    drop_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await reopen_drop(db, drop_id)
    return api_response(data=DropReopenResponse.model_validate(result))


@router.post("/drops/{drop_id}/clear-reopen", response_model=DataResponse[DropReopenResponse])
async def clear_reopen_endpoint(
    drop_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await clear_manual_reopen(db, drop_id)
    return api_response(data=DropReopenResponse.model_validate(result))


@router.post(
    "/tools/cleanup-request-received",
    response_model=DataResponse[AdminCleanupStubsResponse],
)
async def cleanup_request_received_endpoint(
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """One-shot B6b: convert unpublished request_received stubs into tickets.

    Blocked in production (run the script with ``--confirm`` after explicit ops OK).
    """
    result = await cleanup_request_received_stubs(db)
    return api_response(data=AdminCleanupStubsResponse(**result))


# ── Impersonation ───────────────────────────────────────────────────────────


@router.get("/users", response_model=DataResponse[list[AdminUserItem]])
async def list_users_endpoint(
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Org + brand users for the admin impersonation picker."""
    rows = await list_impersonatable_users(db)
    return api_response(data=[AdminUserItem(**r) for r in rows])


@router.post("/impersonate/{user_id}", response_model=DataResponse[ImpersonateResponse])
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
