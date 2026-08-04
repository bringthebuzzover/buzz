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
from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.organization import Organization
from app.models.user import User
from app.response import APIResponse, DataResponse, api_response
from app.schemas.brands import (
    BrandAggregateResponse,
    BrandApplyRequest,
    BrandDropDetailApplicant,
    BrandDropDetailResponse,
    BrandDropListItem,
    BrandDropPostItem,
    BrandProfileResponse,
    EngagementSeriesPoint,
    FinalizeApplicantsRequest,
)
from app.schemas.common import camelize
from app.schemas.drops import BrandDropCreateRequest
from app.security.rate_limit import rate_limited
from app.services.brand_auth import apply_brand
from app.services.brands import (
    _application_linked_posts,
    _drop_aggregate,
    _org_attributed_totals,
    _require_brand,
    compute_brand_aggregate,
    compute_engagement_series,
    finalize_applicants,
    resolve_brand_drop,
)
from app.services.drops import build_brand_drop_response, create_brand_drop

router = APIRouter(prefix="/brands", tags=["brands"])


@router.post(
    "/apply",
    response_model=APIResponse,
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
    return api_response(data=camelize(result))


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


@router.post("/me/drops", response_model=APIResponse)
async def create_drop(
    payload: BrandDropCreateRequest,
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)
    drop = await create_brand_drop(db, brand, payload.title, payload.description)
    return api_response(data=build_brand_drop_response(drop, brand))


@router.get("/me/drops", response_model=APIResponse)
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


@router.get("/me/drops/{drop_id}", response_model=APIResponse)
async def get_brand_drop_detail(
    drop_id: uuid.UUID,
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)
    drop = await resolve_brand_drop(db, brand, drop_id)
    agg = await _drop_aggregate(db, drop.id)

    # Load all applications on this drop, joined with org profiles + owning user
    # (edu email / IG identity live on users).
    rows = list(
        await db.execute(
            sa_select(DropApplication, Organization, User)
            .join(Organization, Organization.id == DropApplication.org_id)
            .join(User, User.id == Organization.user_id)
            .where(DropApplication.drop_id == drop.id)
        )
    )

    applicants: list[BrandDropDetailApplicant] = []
    for app, org, org_user in rows:
        attr = await _org_attributed_totals(db, org.id, drop.id)
        posts = await _application_linked_posts(db, app.id)
        applicants.append(
            BrandDropDetailApplicant(
                id=app.id,
                drop_id=app.drop_id,
                org_id=app.org_id,
                decision=app.decision,
                pitch=app.pitch,
                tracking_number=drop.tracking_number,
                allocated_units=app.allocated_units,
                applied_at=app.applied_at,
                decision_at=app.decision_at,
                org_name=org.org_name,
                university=org.university,
                instagram_handle=org_user.instagram_username or "",
                follower_count=org.follower_count,
                member_count=org.member_count,
                category=org.category,
                delivery_address=org.delivery_address,
                attributed_post_count=attr["attributed_post_count"],
                attributed_likes=attr["attributed_likes"],
                attributed_comments=attr["attributed_comments"],
                attributed_engagement=attr["attributed_engagement"],
                posts=[
                    BrandDropPostItem.model_validate(post, from_attributes=True) for post in posts
                ],
            )
        )

    detail = BrandDropDetailResponse(
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
        tracking_number=drop.tracking_number,
        applications=applicants,
        total_posts=agg["total_posts"],
        total_likes=agg["total_likes"],
        total_comments=agg["total_comments"],
        total_engagement=agg["total_engagement"],
        total_reach=agg["total_reach"],
    )
    return api_response(data=detail)


@router.post("/me/drops/{drop_id}/finalize-applicants", response_model=APIResponse)
async def finalize_drop_applicants(
    drop_id: uuid.UUID,
    payload: FinalizeApplicantsRequest,
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)
    allocations = [{"org_id": a.org_id, "units": a.units} for a in payload.allocations]
    result = await finalize_applicants(db, brand, drop_id, allocations)
    return api_response(data=camelize(result))


@router.get("/me/aggregate", response_model=APIResponse)
async def get_brand_aggregate(
    user: CurrentBrand,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    brand = await _require_brand(db, user)
    agg = await compute_brand_aggregate(db, brand)
    return api_response(data=BrandAggregateResponse(**agg))


@router.get("/me/engagement-series", response_model=APIResponse)
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
