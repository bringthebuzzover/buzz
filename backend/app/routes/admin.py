"""Admin routes — ``/api/admin`` (buzz-ops engineering/architecture.md §5.1, §8.5).

Reads are all ``GET`` and back the admin panel's sidebar sections. Mutations cover
account approve/deny/recovery, drop seat decisions + wrap-up, per-org shipments,
allowlisted table inspect/patch, and impersonation. Remaining stuck states
without a product path stay in buzz-ops ``engineering/gaps/``.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.config import settings
from app.deps.auth import CurrentAdmin
from app.deps.db import get_db
from app.exceptions import BuzzAPIException
from app.models.brand import Brand
from app.models.drop_request import DropRequest
from app.response import APIResponse, DataResponse, api_error_response, api_response
from app.schemas.acks import (
    AdminAddOrgRequest,
    AdminAddOrgResponse,
    AdminBrandEraseRequest,
    AdminBrandEraseResponse,
    AdminBrandInviteResponse,
    AdminBrandStatusResponse,
    AdminComposeEmailRequest,
    AdminComposeEmailResponse,
    AdminDropHideRequest,
    AdminOrgEraseRequest,
    AdminOrgEraseResponse,
    AdminOrgStatusResponse,
    AdminRemoveParticipantRequest,
    AdminRemoveParticipantResponse,
    AdminResendConnectAllResponse,
    AdminSyncAutolinkResponse,
    ClearInstagramTokenResponse,
    DropStageResponse,
    OkResponse,
    SendDecisionsResponse,
)
from app.schemas.admin import (
    AdminBrandDetail,
    AdminBrandIgChangeRequestItem,
    AdminBrandItem,
    AdminCleanupStubsResponse,
    AdminCreateBrandRequest,
    AdminDropConfigPatch,
    AdminDropCreateRequest,
    AdminDropDetail,
    AdminDropItem,
    AdminDropRequestItem,
    AdminHealthResponse,
    AdminIgChangeApproveRequest,
    AdminIgChangeRequestItem,
    AdminOrgApproveRequest,
    AdminOrgDetail,
    AdminOrgItem,
    AdminOverviewResponse,
    ImpersonateRequest,
    ImpersonateResponse,
    ViewAsResumeRequest,
)
from app.schemas.admin_tables import (
    AdminTableInfo,
    AdminTablePatchRequest,
    AdminTableQueryRequest,
    AdminTableQueryResponse,
    AdminTableRowResponse,
)
from app.schemas.auth import UserResponse
from app.schemas.brands import SeatDecisionRequest
from app.schemas.shipments import AdminAddShipmentRequest, ShipmentItem
from app.security import jwt
from app.security.view_as import clear_view_as_cookie, set_view_as_cookie
from app.services.address import AddressClient, get_address_client
from app.services.admin import (
    ack_ig_bind_mismatch,
    add_org_to_drop,
    approve_brand,
    approve_org,
    cleanup_request_received_stubs,
    clear_org_instagram_token,
    compose_brand_email,
    compose_org_email,
    create_admin_drop,
    create_brand,
    deny_brand,
    deny_org,
    hide_drop,
    list_brands,
    list_orgs,
    publish_drop,
    resend_all_pending_instagram_connect,
    resend_brand_invite,
    resend_org_connect,
    sync_and_autolink_drop,
    undeny_brand,
    undeny_org,
    unhide_drop,
    unwrap_drop,
    update_drop_config,
    wrap_drop,
)
from app.services.admin_auth import mint_impersonation_token
from app.services.admin_erase import erase_brand, erase_org_user
from app.services.admin_read import (
    get_brand_detail,
    get_drop_detail,
    get_health,
    get_org_detail,
    get_overview,
    list_drops,
)
from app.services.admin_tables import (
    get_table_row,
    list_table_catalog,
    patch_table_row,
    query_table,
)
from app.services.brand_ig_change_requests import (
    approve_request as approve_brand_ig_change_request,
)
from app.services.brand_ig_change_requests import (
    deny_request as deny_brand_ig_change_request,
)
from app.services.brand_ig_change_requests import (
    list_requests as list_brand_ig_change_requests,
)
from app.services.drop_requests import get_admin_drop_request, list_admin_drop_requests
from app.services.ig_change_requests import (
    approve_request as approve_ig_change_request,
)
from app.services.ig_change_requests import (
    deny_request as deny_ig_change_request,
)
from app.services.ig_change_requests import (
    get_request as get_ig_change_request,
)
from app.services.ig_change_requests import (
    list_requests as list_ig_change_requests,
)
from app.services.instagram import InstagramClient, get_instagram_client
from app.services.remove_participant import remove_participant_from_drop
from app.services.seats import lock_drop, send_decisions, set_seat_decision
from app.services.shipments import add_shipment, delete_shipment

logger = logging.getLogger(__name__)

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
    integrity / silent-loss counts. See buzz-ops ``engineering/gaps/`` for why the pipeline
    block is inferred rather than measured."""
    return api_response(data=AdminHealthResponse(**await get_health(db)))


# ── Organizations ───────────────────────────────────────────────────────────


@router.get("/orgs", response_model=DataResponse[list[AdminOrgItem]])
async def list_orgs_endpoint(
    _user: CurrentAdmin,
    status: str | None = Query(default=None),
    attention: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_orgs(db, status=status, attention=attention)
    return api_response(data=[AdminOrgItem(**r) for r in rows])


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
    """Erase an org: scrub identity and freeze its campaign metrics."""
    result = await erase_org_user(db, user_id, body.confirm)
    return api_response(data=AdminOrgEraseResponse.model_validate(result))


@router.post(
    "/orgs/{user_id}/send-email",
    response_model=DataResponse[AdminComposeEmailResponse],
)
async def compose_org_email_endpoint(
    user_id: uuid.UUID,
    body: AdminComposeEmailRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Freeform Resend to the org .edu. To is the profile email, not the body."""
    result = await compose_org_email(db, user_id, body.subject, body.body)
    return api_response(data=AdminComposeEmailResponse.model_validate(result))


@router.post(
    "/orgs/{org_id}/ig-bind-mismatch/ack",
    response_model=DataResponse[OkResponse],
)
async def ack_ig_bind_mismatch_endpoint(
    org_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Dismiss an open Connect handle mismatch. Does not change Graph bind."""
    result = await ack_ig_bind_mismatch(db, org_id)
    return api_response(data=OkResponse(**result))


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
    "/orgs/resend-connect-all",
    response_model=DataResponse[AdminResendConnectAllResponse],
)
async def resend_all_pending_instagram_connect_endpoint(
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Email Connect Instagram to every ``pending_instagram`` org.

    Does not email orgs still verifying school email or awaiting approval.
    """
    result = await resend_all_pending_instagram_connect(db)
    return api_response(data=AdminResendConnectAllResponse.model_validate(result))


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


@router.get(
    "/ig-change-requests",
    response_model=DataResponse[list[AdminIgChangeRequestItem]],
)
async def list_ig_change_requests_endpoint(
    _user: CurrentAdmin,
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_ig_change_requests(db, status=status)
    return api_response(data=[AdminIgChangeRequestItem.model_validate(row) for row in rows])


@router.get(
    "/ig-change-requests/{request_id}",
    response_model=DataResponse[AdminIgChangeRequestItem],
)
async def get_ig_change_request_endpoint(
    request_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    return api_response(
        data=AdminIgChangeRequestItem.model_validate(await get_ig_change_request(db, request_id))
    )


@router.post(
    "/ig-change-requests/{request_id}/approve",
    response_model=DataResponse[AdminIgChangeRequestItem],
)
async def approve_ig_change_request_endpoint(
    request_id: uuid.UUID,
    body: AdminIgChangeApproveRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await approve_ig_change_request(
        db,
        request_id,
        kind=body.kind,
        tester_invite_confirmed=body.tester_invite_confirmed,
    )
    return api_response(data=AdminIgChangeRequestItem.model_validate(result))


@router.post(
    "/ig-change-requests/{request_id}/deny",
    response_model=DataResponse[AdminIgChangeRequestItem],
)
async def deny_ig_change_request_endpoint(
    request_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    return api_response(
        data=AdminIgChangeRequestItem.model_validate(await deny_ig_change_request(db, request_id))
    )


@router.get(
    "/brand-ig-change-requests",
    response_model=DataResponse[list[AdminBrandIgChangeRequestItem]],
)
async def list_brand_ig_change_requests_endpoint(
    _user: CurrentAdmin,
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_brand_ig_change_requests(db, status=status)
    return api_response(data=[AdminBrandIgChangeRequestItem.model_validate(row) for row in rows])


@router.post(
    "/brand-ig-change-requests/{request_id}/approve",
    response_model=DataResponse[AdminBrandIgChangeRequestItem],
)
async def approve_brand_ig_change_request_endpoint(
    request_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await approve_brand_ig_change_request(db, request_id)
    return api_response(data=AdminBrandIgChangeRequestItem.model_validate(result))


@router.post(
    "/brand-ig-change-requests/{request_id}/deny",
    response_model=DataResponse[AdminBrandIgChangeRequestItem],
)
async def deny_brand_ig_change_request_endpoint(
    request_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await deny_brand_ig_change_request(db, request_id)
    return api_response(data=AdminBrandIgChangeRequestItem.model_validate(result))


# ── Brands ──────────────────────────────────────────────────────────────────


@router.get("/brands", response_model=DataResponse[list[AdminBrandItem]])
async def list_brands_endpoint(
    _user: CurrentAdmin,
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_brands(db, status=status)
    return api_response(data=[AdminBrandItem(**r) for r in rows])


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


@router.post(
    "/brands/{brand_id}/erase",
    response_model=DataResponse[AdminBrandEraseResponse],
)
async def erase_brand_endpoint(
    brand_id: uuid.UUID,
    body: AdminBrandEraseRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Hybrid erase: scrub brand login/PII; keep drops and org campaign history."""
    result = await erase_brand(db, brand_id, body.confirm)
    return api_response(data=AdminBrandEraseResponse.model_validate(result))


@router.post(
    "/brands/{brand_id}/send-email",
    response_model=DataResponse[AdminComposeEmailResponse],
)
async def compose_brand_email_endpoint(
    brand_id: uuid.UUID,
    body: AdminComposeEmailRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Freeform Resend to the brand company email. To is not client-supplied."""
    result = await compose_brand_email(db, brand_id, body.subject, body.body)
    return api_response(data=AdminComposeEmailResponse.model_validate(result))


# ── Drop requests (intake tickets) ───────────────────────────────────────────


def _admin_drop_request_item(ticket: DropRequest, brand: Brand) -> AdminDropRequestItem:
    return AdminDropRequestItem(
        id=ticket.id,
        brand_id=ticket.brand_id,
        brand_name=brand.brand_name,
        message=ticket.message,
        product=ticket.product,
        title=ticket.title,
        location=ticket.location,
        target_date=ticket.target_date,
        org_count=ticket.org_count,
        units_per_org=ticket.units_per_org,
        campaign_hashtag=ticket.campaign_hashtag,
        notes=ticket.notes,
        status=ticket.status,
        converted_drop_id=ticket.converted_drop_id,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


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
    return api_response(data=[_admin_drop_request_item(ticket, brand) for ticket, brand in rows])


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
    return api_response(data=_admin_drop_request_item(ticket, brand))


# ── Drops ───────────────────────────────────────────────────────────────────


@router.get("/drops", response_model=DataResponse[list[AdminDropItem]])
async def list_drops_endpoint(
    _user: CurrentAdmin,
    stage: list[str] | None = Query(default=None),
    attention: list[str] | None = Query(default=None),
    published: str | None = Query(default=None, pattern="^(draft|published)$"),
    hidden: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    rows = await list_drops(
        db, stage=stage, attention=attention, published=published, hidden=hidden
    )
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


@router.post(
    "/drops/{drop_id}/hide",
    response_model=DataResponse[AdminDropDetail],
)
async def hide_drop_endpoint(
    drop_id: uuid.UUID,
    payload: AdminDropHideRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    await hide_drop(db, drop_id, confirm=payload.confirm, notify_brand=payload.notify_brand)
    return api_response(data=AdminDropDetail(**await get_drop_detail(db, drop_id)))


@router.post(
    "/drops/{drop_id}/unhide",
    response_model=DataResponse[AdminDropDetail],
)
async def unhide_drop_endpoint(
    drop_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    await unhide_drop(db, drop_id)
    return api_response(data=AdminDropDetail(**await get_drop_detail(db, drop_id)))


@router.post(
    "/drops/{drop_id}/applications/{application_id}/remove",
    response_model=DataResponse[AdminRemoveParticipantResponse],
)
async def remove_participant_endpoint(
    drop_id: uuid.UUID,
    application_id: uuid.UUID,
    body: AdminRemoveParticipantRequest,
    admin: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Remove one org from one drop. Deletes that seat, its shipments, and its linked metrics."""
    result = await remove_participant_from_drop(
        db,
        actor_id=admin.id,
        drop_id=drop_id,
        application_id=application_id,
        confirm=body.confirm,
    )
    return api_response(data=AdminRemoveParticipantResponse.model_validate(result))


@router.post(
    "/drops/{drop_id}/add-org",
    response_model=DataResponse[AdminAddOrgResponse],
)
async def add_org_to_drop_endpoint(
    drop_id: uuid.UUID,
    payload: AdminAddOrgRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Accept an org onto a published drop without reopening apply."""
    result = await add_org_to_drop(
        db,
        drop_id,
        payload.org_id,
        allocated_units=payload.allocated_units,
        email_org=payload.email_org,
        email_brand=payload.email_brand,
    )
    return api_response(data=AdminAddOrgResponse.model_validate(result))


@router.post(
    "/drops/{drop_id}/sync-and-autolink",
    response_model=DataResponse[AdminSyncAutolinkResponse],
)
async def sync_and_autolink_drop_endpoint(
    drop_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
    ig: InstagramClient = Depends(get_instagram_client),
) -> APIResponse:
    """Pull Graph for this drop's accepted orgs, then mint autolink suggestions."""
    result = await sync_and_autolink_drop(db, drop_id, ig)
    return api_response(data=AdminSyncAutolinkResponse.model_validate(result))


@router.patch("/drops/{drop_id}", response_model=DataResponse[AdminDropDetail])
async def patch_drop_config_endpoint(
    drop_id: uuid.UUID,
    payload: AdminDropConfigPatch,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    await update_drop_config(db, drop_id, payload)
    return api_response(data=AdminDropDetail(**await get_drop_detail(db, drop_id)))


@router.put(
    "/drops/{drop_id}/applications/{application_id}/decision",
    response_model=DataResponse[AdminDropDetail],
)
async def put_seat_decision_endpoint(
    drop_id: uuid.UUID,
    application_id: uuid.UUID,
    payload: SeatDecisionRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Draft one seat's decision (any stage, may overbook; goes out on the next send)."""
    drop = await lock_drop(db, drop_id)
    await set_seat_decision(
        db,
        drop,
        application_id,
        decision=payload.decision,
        allocated_units=payload.allocated_units,
        actor="admin",
    )
    return api_response(data=AdminDropDetail(**await get_drop_detail(db, drop_id)))


@router.post(
    "/drops/{drop_id}/send-decisions",
    response_model=DataResponse[SendDecisionsResponse],
)
async def send_decisions_endpoint(
    drop_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Send every drafted decision on the drop (any stage)."""
    drop = await lock_drop(db, drop_id)
    result = await send_decisions(db, drop, actor="admin")
    return api_response(data=SendDecisionsResponse.model_validate(result))


@router.post("/drops/{drop_id}/wrap", response_model=DataResponse[DropStageResponse])
async def wrap_drop_endpoint(
    drop_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    return api_response(data=DropStageResponse.model_validate(await wrap_drop(db, drop_id)))


@router.post("/drops/{drop_id}/unwrap", response_model=DataResponse[DropStageResponse])
async def unwrap_drop_endpoint(
    drop_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    return api_response(data=DropStageResponse.model_validate(await unwrap_drop(db, drop_id)))


@router.post(
    "/applications/{application_id}/shipments",
    response_model=DataResponse[ShipmentItem],
)
async def add_application_shipment(
    application_id: uuid.UUID,
    payload: AdminAddShipmentRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await add_shipment(db, application_id, payload.tracking_number, payload.carrier)
    return api_response(data=ShipmentItem.model_validate(result))


@router.delete(
    "/applications/{application_id}/shipments/{shipment_id}",
    response_model=DataResponse[OkResponse],
)
async def delete_application_shipment(
    application_id: uuid.UUID,
    shipment_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await delete_shipment(db, application_id, shipment_id)
    return api_response(data=OkResponse.model_validate(result))


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


# ── Table inspect (MCP / ops) ───────────────────────────────────────────────


@router.get("/tables", response_model=DataResponse[list[AdminTableInfo]])
async def list_admin_tables(_user: CurrentAdmin) -> APIResponse:
    """Allowlisted tables + column flags. Hidden columns never appear in row payloads."""
    return api_response(data=[AdminTableInfo(**item) for item in list_table_catalog()])


@router.post("/tables/{table}/query", response_model=DataResponse[AdminTableQueryResponse])
async def query_admin_table(
    table: str,
    payload: AdminTableQueryRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await query_table(
        db, table, filters=payload.filters, limit=payload.limit, offset=payload.offset
    )
    return api_response(data=AdminTableQueryResponse(**result))


@router.get("/tables/{table}/{row_id}", response_model=DataResponse[AdminTableRowResponse])
async def get_admin_table_row(
    table: str,
    row_id: uuid.UUID,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    return api_response(data=AdminTableRowResponse(**await get_table_row(db, table, row_id)))


@router.patch("/tables/{table}/{row_id}", response_model=DataResponse[AdminTableRowResponse])
async def patch_admin_table_row(
    table: str,
    row_id: uuid.UUID,
    payload: AdminTablePatchRequest,
    _user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
    addresses: AddressClient = Depends(get_address_client),
) -> APIResponse:
    result = await patch_table_row(db, table, row_id, payload.fields, addresses)
    return api_response(data=AdminTableRowResponse(**result))


# ── Impersonation ───────────────────────────────────────────────────────────


def _impersonate_body(token: str, target: UserResponse) -> ImpersonateResponse:
    return ImpersonateResponse(
        access_token=token,
        user=target,
        readonly=settings.IMPERSONATION_READONLY,
    )


def _view_as_error(status_code: int, code: str, message: str, *, clear: bool) -> JSONResponse:
    body = api_error_response(code=code, message=message)
    resp = JSONResponse(status_code=status_code, content=body.model_dump())
    if clear:
        clear_view_as_cookie(resp)
    return resp


@router.post("/impersonate/resume", response_model=DataResponse[ImpersonateResponse])
async def resume_impersonation_endpoint(
    body: ViewAsResumeRequest,
    request: Request,
    user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
) -> APIResponse | JSONResponse:
    """Remint View as from the httpOnly intent cookie.

    Requires the caller's own admin access token. The cookie alone is not a
    session. Missing cookie is 404 (nothing to resume). A cookie whose role
    does not match ``body.role`` is also 404 and is left in place, so opening
    an org URL does not mint a brand session or destroy it. A cookie minted
    for a different admin, a stale ``imp_ver``, or a target that can no longer
    be impersonated is rejected and the cookie is cleared.

    Does not rewrite the cookie. The 8h cap is fixed at the first mint;
    refresh rotation updates ``imp_ver`` without extending ``exp``.
    """

    raw = request.cookies.get(settings.VIEW_AS_COOKIE_NAME)
    if not raw:
        return _view_as_error(
            404,
            errors.NOT_FOUND,
            "No view-as session.",
            clear=False,
        )
    try:
        payload = jwt.decode_token(raw, expected_type=jwt.VIEW_AS_TOKEN_TYPE)
    except jwt.TokenError:
        return _view_as_error(
            401,
            errors.VIEW_AS_INVALID,
            "View-as session is no longer valid.",
            clear=True,
        )
    if payload.role != body.role:
        return _view_as_error(
            404,
            errors.NOT_FOUND,
            "No view-as session for this page.",
            clear=False,
        )
    if payload.imp != str(user.id) or payload.sub is None:
        return _view_as_error(
            403,
            errors.FORBIDDEN,
            "View-as session does not belong to this admin.",
            clear=True,
        )
    if payload.imp_ver is None or payload.imp_ver != (user.token_version or 0):
        return _view_as_error(
            401,
            errors.VIEW_AS_INVALID,
            "View-as session is no longer valid.",
            clear=True,
        )
    try:
        target_id = uuid.UUID(payload.sub)
    except ValueError:
        return _view_as_error(
            401,
            errors.VIEW_AS_INVALID,
            "View-as session is no longer valid.",
            clear=True,
        )
    try:
        token, target = await mint_impersonation_token(db, user, target_id)
    except BuzzAPIException as exc:
        if exc.status_code in (403, 404):
            return _view_as_error(exc.status_code, exc.code, exc.message, clear=True)
        raise
    logger.info(
        "view-as resume admin=%s target=%s role=%s",
        user.id,
        target.id,
        target.portal_role,
    )
    return api_response(data=_impersonate_body(token, target))


def _continuation_expiry(started_at_ms: int) -> datetime:
    """Cookie deadline for a latch remint. Refuses a start outside the window."""

    try:
        started = datetime.fromtimestamp(started_at_ms / 1000.0, tz=timezone.utc)
    except (OverflowError, OSError, ValueError) as exc:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "View-as start time is invalid.",
            status_code=400,
        ) from exc
    now = datetime.now(timezone.utc)
    if started > now + timedelta(minutes=5):
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "View-as start time is invalid.",
            status_code=400,
        )
    deadline = started + timedelta(hours=settings.VIEW_AS_INTENT_TTL_HOURS)
    if deadline <= now:
        raise BuzzAPIException(
            errors.VIEW_AS_INVALID,
            "View-as session has expired.",
            status_code=403,
        )
    return deadline


@router.post("/impersonate/{user_id}", response_model=DataResponse[ImpersonateResponse])
async def impersonate_endpoint(
    user_id: uuid.UUID,
    response: Response,
    user: CurrentAdmin,
    db: AsyncSession = Depends(get_db),
    body: ImpersonateRequest | None = None,
) -> APIResponse:
    """Mint a short-lived access token that acts as ``user_id``.

    Intentionally does NOT set a refresh cookie: the admin's own refresh session
    must survive so exiting impersonation does not require a second login.
    It does set an httpOnly intent cookie so a full page load can remint.

    A body ``started_at`` is a continuation of a session that already started
    (the same-tab latch). The cookie then expires at that start plus the
    intent TTL, and a start older than the TTL is refused. Omitting it starts
    a new 8h window (the admin clicked View as).
    """
    expires_at: datetime | None = None
    max_age: int | None = None
    if body is not None and body.started_at is not None:
        expires_at = _continuation_expiry(body.started_at)
        max_age = max(1, int((expires_at - datetime.now(timezone.utc)).total_seconds()))
    token, target = await mint_impersonation_token(db, user, user_id)
    intent = jwt.create_view_as_intent_token(
        user.id,
        target.id,
        target.portal_role,
        impersonator_token_version=user.token_version or 0,
        expires_at=expires_at,
    )
    set_view_as_cookie(response, intent, max_age=max_age)
    logger.info(
        "view-as mint admin=%s target=%s role=%s",
        user.id,
        target.id,
        target.portal_role,
    )
    return api_response(data=_impersonate_body(token, target))
