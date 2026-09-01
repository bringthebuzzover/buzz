"""Brand routes — ``/api/brands`` (architecture.md §5.1, §8.1–§8.4).

Stage 5C adds the brand portal backend: profile, drop creation, drops list
with per-drop aggregate, drop detail with applicants + attributed totals,
finalize applicants, brand aggregate, and engagement time series.
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
from app.schemas.acks import BrandApplyResponse, FinalizeApplicantsResponse
from app.schemas.brands import (
    BrandAggregateResponse,
    BrandApplyRequest,
    BrandDropCreativePatch,
    BrandDropDetailResponse,
    BrandDropListItem,
    BrandProfileResponse,
    EngagementSeriesPoint,
    FinalizeApplicantsRequest,
)
from app.schemas.drops import BrandDropRequestCreate, BrandDropRequestResponse
from app.security.rate_limit import rate_limited
from app.services.brand_auth import apply_brand
from app.services.brands import (
    _drop_aggregate,
    _require_brand,
    build_brand_drop_detail,
    compute_brand_aggregate,
    compute_engagement_series,
    finalize_applicants,
    resolve_brand_drop,
    update_brand_drop_creative,
)
from app.services.drop_requests import (
    build_drop_request_response,
    create_brand_drop_request,
    get_brand_drop_request,
    list_brand_drop_requests,
)

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
    """Plan your Campaign — create an intake ticket (LAUNCH.md Phase B)."""
    brand = await _require_brand(db, user)
    ticket = await create_brand_drop_request(
        db, brand, message=payload.message, notes=payload.notes
    )
    return api_response(data=build_drop_request_response(ticket))


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
    return api_response(data=[build_drop_request_response(t) for t in tickets])


@router.get(
    "/me/drop-requests/{request_id}",
    response_model=DataResponse[BrandDropRequestResponse],
)
async def get_drop_request(
    request_id: uuid.UUID,
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)
    ticket = await get_brand_drop_request(db, brand, request_id)
    return api_response(data=build_drop_request_response(ticket))


@router.get("/me/drops", response_model=DataResponse[list[BrandDropListItem]])
async def list_brand_drops(
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)

    drops = list(
        await db.scalars(
            sa_select(Drop)
            .where(Drop.brand_id == brand.id)
            .order_by(Drop.created_at.desc(), Drop.id.desc())
        )
    )

    items: list[BrandDropListItem] = []
    for drop in drops:
        agg = await _drop_aggregate(db, drop.id)
        items.append(
            BrandDropListItem(
                id=drop.id,
                brand_id=drop.brand_id,
                brand_name=brand.brand_name,
                title=drop.title,
                description=drop.description,
                image=drop.image,
                location=drop.location,
                capacity_total=drop.capacity_total,
                apply_open_at=drop.apply_open_at,
                apply_close_at=drop.apply_close_at,
                manual_reopen=drop.manual_reopen,
                brand_tracker_stage=drop.brand_tracker_stage,
                total_product_units=drop.total_product_units,
                campaign_hashtag=drop.campaign_hashtag,
                applicant_selection_finalized_at=drop.applicant_selection_finalized_at,
                created_at=drop.created_at,
                total_posts=agg["total_posts"],
                total_likes=agg["total_likes"],
                total_comments=agg["total_comments"],
                total_engagement=agg["total_engagement"],
                total_reach=agg["total_reach"],
            )
        )
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


@router.post(
    "/me/drops/{drop_id}/finalize-applicants",
    response_model=DataResponse[FinalizeApplicantsResponse],
)
async def finalize_drop_applicants(
    drop_id: uuid.UUID,
    payload: FinalizeApplicantsRequest,
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)
    allocations = [{"org_id": a.org_id, "units": a.units} for a in payload.allocations]
    result = await finalize_applicants(db, brand, drop_id, allocations)
    return api_response(data=FinalizeApplicantsResponse.model_validate(result))


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
