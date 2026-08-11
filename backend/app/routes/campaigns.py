"""My-Campaigns routes — ``/api/campaigns`` (architecture.md §5.1, §7.2/§7.3/§7.4).

Org-only. Denied applications are never returned (filtered from the list, 404
on detail). Every ``/{id}/*`` sub-resource verifies caller ownership via the
service layer (404 otherwise) — no IDOR. Returns all rows (no pagination) per §7.2.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.auth import CurrentOrg
from app.deps.db import get_db
from app.response import APIResponse, DataResponse, api_response
from app.schemas.acks import OkResponse
from app.schemas.campaigns import CampaignDetailResponse, CampaignListItem
from app.schemas.posts import (
    CampaignAggregateResponse,
    LinkPostRequest,
    PostResponse,
    SuggestionResponse,
)
from app.services.campaigns import get_my_campaign, list_my_campaigns
from app.services.posts import (
    accept_suggestion,
    dismiss_suggestion,
    get_campaign_aggregate,
    link_post,
    list_suggestions,
    unlink_post,
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=DataResponse[list[CampaignListItem]])
async def list_campaigns(
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """The caller org's campaigns (non-denied applications + joined drop)."""

    return api_response(data=await list_my_campaigns(db, user))


@router.get("/{application_id}", response_model=DataResponse[CampaignDetailResponse])
async def campaign_detail(
    application_id: uuid.UUID,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """One campaign owned by the caller org (404 otherwise)."""

    return api_response(data=await get_my_campaign(db, user, application_id))


@router.get(
    "/{application_id}/aggregate",
    response_model=DataResponse[CampaignAggregateResponse],
)
async def campaign_aggregate(
    application_id: uuid.UUID,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Per-campaign metric rollup (postCount/likes/comments/engagement/reach)."""

    return api_response(data=await get_campaign_aggregate(db, user, application_id))


@router.post("/{application_id}/link-post", response_model=DataResponse[PostResponse])
async def link_campaign_post(
    application_id: uuid.UUID,
    payload: LinkPostRequest,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Manually link a post (409 ``POST_ALREADY_LINKED``; 422 Stories)."""

    post = await link_post(db, user, application_id, payload.post_id)
    return api_response(data=post)


@router.delete("/{application_id}/link-post", response_model=DataResponse[OkResponse])
async def unlink_campaign_post(
    application_id: uuid.UUID,
    payload: LinkPostRequest,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Unlink a post from this campaign (idempotent)."""

    await unlink_post(db, user, application_id, payload.post_id)
    return api_response(data=OkResponse())


@router.get(
    "/{application_id}/suggestions",
    response_model=DataResponse[list[SuggestionResponse]],
)
async def campaign_suggestions(
    application_id: uuid.UUID,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Pending auto-link suggestions for this campaign."""

    return api_response(data=await list_suggestions(db, user, application_id))


@router.post(
    "/{application_id}/suggestions/{post_id}/accept",
    response_model=DataResponse[PostResponse],
)
async def accept_campaign_suggestion(
    application_id: uuid.UUID,
    post_id: uuid.UUID,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Confirm a suggestion and link the post (409/404)."""

    post = await accept_suggestion(db, user, application_id, post_id)
    return api_response(data=post)


@router.post(
    "/{application_id}/suggestions/{post_id}/dismiss",
    response_model=DataResponse[OkResponse],
)
async def dismiss_campaign_suggestion(
    application_id: uuid.UUID,
    post_id: uuid.UUID,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Reject a pending suggestion (404 ``SUGGESTION_NOT_FOUND``)."""

    await dismiss_suggestion(db, user, application_id, post_id)
    return api_response(data=OkResponse())
