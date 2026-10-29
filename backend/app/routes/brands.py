"""Brand routes — ``/api/brands`` (buzz-ops engineering/architecture.md §5.1, §8.1–§8.4).

Stage 5C adds the brand portal backend: profile, drop creation, drops list
with per-drop aggregate, drop detail with applicants + attributed totals,
per-seat decisions + send decisions, brand aggregate, and engagement time series.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select as sa_select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.config import settings
from app.deps.auth import CurrentBrand
from app.deps.db import get_db
from app.exceptions import BuzzAPIException
from app.models.drop import Drop
from app.response import APIResponse, DataResponse, api_response
from app.schemas.acks import BrandApplyResponse, SendDecisionsResponse
from app.schemas.brands import (
    BrandAggregateResponse,
    BrandApplyRequest,
    BrandDropCreativePatch,
    BrandDropDetailResponse,
    BrandDropListItem,
    BrandIgChangeRequestCreate,
    BrandIgChangeRequestResponse,
    BrandIgChangeRequestState,
    BrandProfilePatch,
    BrandProfileResponse,
    EngagementSeriesPoint,
    SeatDecisionRequest,
)
from app.schemas.drops import BrandDropRequestCreate, BrandDropRequestResponse
from app.security.rate_limit import rate_limited
from app.services.brand_auth import apply_brand
from app.services.brand_ig_change_requests import (
    get_request_state as get_brand_ig_change_state,
)
from app.services.brand_ig_change_requests import (
    submit_request as submit_brand_ig_change,
)
from app.services.brands import (
    _require_brand,
    build_brand_drop_detail,
    build_brand_drop_list_item,
    compute_brand_aggregate,
    compute_engagement_series,
    resolve_brand_drop,
    update_brand_drop_creative,
)
from app.services.drop_requests import (
    brand_drop_request_response,
    create_brand_drop_request,
    list_brand_drop_requests,
)
from app.services.lifecycle import drop_stages
from app.services.seats import lock_drop, send_decisions, set_seat_decision

router = APIRouter(prefix="/brands", tags=["brands"])


@router.post(
    "/apply",
    response_model=DataResponse[BrandApplyResponse],
    dependencies=[Depends(rate_limited("brand_apply", limit=5, window=60))],
)
async def brand_apply(
    payload: BrandApplyRequest,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Public brand self-registration (→ pending_review).

    Disabled (403) when ``BRAND_SELF_REGISTRATION_ENABLED`` is false, so brands
    can be admin-provisioned only without any other code change.
    """
    if not settings.BRAND_SELF_REGISTRATION_ENABLED:
        raise BuzzAPIException(
            errors.BRAND_REGISTRATION_DISABLED,
            "Brand self-registration is currently disabled.",
            status_code=403,
        )
    result = await apply_brand(
        db,
        brand_name=payload.brand_name,
        company_email=payload.company_email,
        instagram_handle=payload.instagram_handle,
        intent_message=payload.intent_message,
    )
    return api_response(data=BrandApplyResponse.model_validate(result))


# Pattern to copy: declare the typed envelope (response_model=DataResponse[T]) so
# the OpenAPI spec describes `data` precisely and the generated frontend types
# catch drift. New/changed endpoints should adopt this; the handler still returns
# api_response() — FastAPI serializes it through response_model.
@router.get("/me", response_model=DataResponse[BrandProfileResponse])
async def get_brand_profile(
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)
    return api_response(data=BrandProfileResponse.model_validate(brand, from_attributes=True))


@router.patch(
    "/me",
    response_model=DataResponse[BrandProfileResponse],
    dependencies=[Depends(rate_limited("brand_profile_patch", limit=10, window=60))],
)
async def patch_brand_profile(
    payload: BrandProfilePatch,
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Update the brand's display name. Handle and email are not accepted."""
    brand = await _require_brand(db, user)
    if payload.brand_name is not None:
        brand.brand_name = payload.brand_name
    await db.flush()
    return api_response(data=BrandProfileResponse.model_validate(brand, from_attributes=True))


@router.get(
    "/me/ig-change-request",
    response_model=DataResponse[BrandIgChangeRequestState],
)
async def get_my_brand_ig_change_request(
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)
    state = await get_brand_ig_change_state(db, brand)
    return api_response(data=BrandIgChangeRequestState.model_validate(state))


@router.post(
    "/me/ig-change-requests",
    response_model=DataResponse[BrandIgChangeRequestResponse],
    dependencies=[Depends(rate_limited("brand_ig_change", limit=10, window=60))],
)
async def create_my_brand_ig_change_request(
    payload: BrandIgChangeRequestCreate,
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)
    row = await submit_brand_ig_change(
        db,
        brand,
        user,
        requested_handle=payload.requested_handle,
        reason=payload.reason,
    )
    return api_response(data=BrandIgChangeRequestResponse.model_validate(row))


@router.post(
    "/me/drop-requests",
    response_model=DataResponse[BrandDropRequestResponse],
    dependencies=[Depends(rate_limited("brand_drop_request", limit=10, window=60))],
)
async def create_drop_request(
    payload: BrandDropRequestCreate,
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Plan your Campaign — create an intake ticket."""
    brand = await _require_brand(db, user)
    ticket = await create_brand_drop_request(db, brand, payload)
    return api_response(data=await brand_drop_request_response(db, ticket))


@router.get(
    "/me/drop-requests",
    response_model=DataResponse[list[BrandDropRequestResponse]],
)
async def list_drop_requests(
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)
    tickets = await list_brand_drop_requests(db, brand)
    return api_response(data=[await brand_drop_request_response(db, t) for t in tickets])


@router.get("/me/drops", response_model=DataResponse[list[BrandDropListItem]])
async def list_brand_drops(
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)

    drops = list(
        await db.scalars(
            sa_select(Drop)
            .where(Drop.brand_id == brand.id, Drop.hidden_at.is_(None))
            .order_by(Drop.created_at.desc(), Drop.id.desc())
        )
    )

    stages = await drop_stages(db, [drop.id for drop in drops])
    items = [await build_brand_drop_list_item(db, brand, drop, stages[drop.id]) for drop in drops]
    return api_response(data=items)


@router.get("/me/drops/{drop_id}", response_model=DataResponse[BrandDropDetailResponse])
async def get_brand_drop_detail(
    drop_id: uuid.UUID,
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)
    drop = await resolve_brand_drop(db, brand, drop_id)
    return api_response(data=await build_brand_drop_detail(db, brand, drop))


@router.patch("/me/drops/{drop_id}", response_model=DataResponse[BrandDropDetailResponse])
async def patch_brand_drop_creative(
    drop_id: uuid.UUID,
    payload: BrandDropCreativePatch,
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)
    drop = await resolve_brand_drop(db, brand, drop_id)
    await update_brand_drop_creative(db, drop, payload)
    return api_response(data=await build_brand_drop_detail(db, brand, drop))


@router.put(
    "/me/drops/{drop_id}/applications/{application_id}/decision",
    response_model=DataResponse[BrandDropDetailResponse],
)
async def put_seat_decision(
    drop_id: uuid.UUID,
    application_id: uuid.UUID,
    payload: SeatDecisionRequest,
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Draft one applicant's decision. Nothing reaches the org until Send decisions."""

    brand = await _require_brand(db, user)
    await resolve_brand_drop(db, brand, drop_id)
    drop = await lock_drop(db, drop_id)
    await set_seat_decision(
        db,
        drop,
        application_id,
        decision=payload.decision,
        allocated_units=payload.allocated_units,
        actor="brand",
    )
    return api_response(data=await build_brand_drop_detail(db, brand, drop))


@router.post(
    "/me/drops/{drop_id}/send-decisions",
    response_model=DataResponse[SendDecisionsResponse],
)
async def post_send_decisions(
    drop_id: uuid.UUID,
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Send every drafted decision (repeatable; undecided applicants keep waiting)."""

    brand = await _require_brand(db, user)
    await resolve_brand_drop(db, brand, drop_id)
    drop = await lock_drop(db, drop_id)
    result = await send_decisions(db, drop, actor="brand")
    return api_response(data=SendDecisionsResponse.model_validate(result))


@router.get("/me/aggregate", response_model=DataResponse[BrandAggregateResponse])
async def get_brand_aggregate(
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)
    agg = await compute_brand_aggregate(db, brand)
    return api_response(data=BrandAggregateResponse(**agg))


@router.get("/me/engagement-series", response_model=DataResponse[list[EngagementSeriesPoint]])
async def get_engagement_series(
    user: CurrentBrand,
    bucket_count: int = Query(12, ge=1, le=100),
    window_days: int = Query(14, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)
    series = await compute_engagement_series(
        db, brand, bucket_count=bucket_count, window_days=window_days
    )
    return api_response(data=[EngagementSeriesPoint(**p) for p in series])
