"""Creator routes — ``/api/creators``."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.models.user import User
from app.response import APIResponse, DataResponse, api_response
from app.schemas.creators import (
    CreatorApplyRequest,
    CreatorApplyResponse,
    CreatorLinkPostRequest,
    CreatorPitchRequest,
    CreatorPortfolioCreate,
    CreatorProfileResponse,
    CreatorStatusResponse,
    CreatorVerifyRequest,
)
from app.security.rate_limit import rate_limited
from app.services.creator_drops import (
    apply_to_creator_drop,
    creator_earnings,
    list_creator_feed,
)
from app.services.creator_posts import link_creator_post, list_creator_posts
from app.services.creators import (
    add_portfolio_item,
    apply_creator,
    confirm_creator_email,
    creator_profile,
)

router = APIRouter(prefix="/creators", tags=["creators"])


@router.post(
    "/apply",
    response_model=DataResponse[CreatorApplyResponse],
    dependencies=[Depends(rate_limited("creator_apply", limit=5, window=60))],
)
async def creator_apply(
    payload: CreatorApplyRequest,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Public creator apply. Does not open a feed session."""
    result = await apply_creator(db, payload)
    return api_response(data=CreatorApplyResponse.model_validate(result))


@router.post(
    "/verify-email",
    response_model=DataResponse[CreatorStatusResponse],
)
async def creator_verify_email(
    payload: CreatorVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Confirm the campus email. Does not mint a feed session."""
    result = await confirm_creator_email(db, payload.token)
    return api_response(data=CreatorStatusResponse.model_validate(result))


@router.get("/me", response_model=DataResponse[CreatorProfileResponse])
async def creator_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    return api_response(data=CreatorProfileResponse.model_validate(await creator_profile(db, user)))


@router.post("/me/portfolio", response_model=DataResponse[CreatorProfileResponse])
async def creator_add_portfolio(
    payload: CreatorPortfolioCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    updated = await add_portfolio_item(db, user, payload.title, payload.link)
    return api_response(data=CreatorProfileResponse.model_validate(updated))


@router.get("/earnings")
async def creator_earnings_route(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    return api_response(data=await creator_earnings(db, user))


@router.get("/posts")
async def creator_posts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    return api_response(data={"posts": await list_creator_posts(db, user)})


@router.post("/posts/link")
async def creator_link_post(
    payload: CreatorLinkPostRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await link_creator_post(db, user, payload.application_id, payload.post_id)
    return api_response(data=result)


@router.get("/feed")
async def creator_feed(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Creator drops only. Closed until the creator is active."""
    drops = await list_creator_feed(db, user)
    return api_response(data={"drops": drops})


@router.post("/drops/{drop_id}/apply")
async def creator_apply_to_drop(
    drop_id: uuid.UUID,
    payload: CreatorPitchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    result = await apply_to_creator_drop(db, user, drop_id, payload.pitch)
    return api_response(data=result)
