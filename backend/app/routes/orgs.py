"""Org profile routes — ``/api/orgs`` (architecture.md §5.1).

``POST /api/orgs/onboarding`` (Stage 7) creates the org profile and advances the
account to email verification; the rest is the active-org profile read/update +
posts surface.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.deps.auth import CurrentOrg, get_current_user
from app.deps.db import get_db
from app.exceptions import BuzzAPIException
from app.models.organization import Organization
from app.models.user import User
from app.response import APIResponse, DataResponse, api_response
from app.schemas.acks import OrgOnboardingResponse
from app.schemas.address import (
    AddressPreviewResponse,
    AddressSuggestionItem,
    AddressSuggestResponse,
)
from app.schemas.onboarding import (
    InstagramLookupResponse,
    OrgApplyPrefillResponse,
    OrgApplyRequest,
    OrgOnboardingRequest,
)
from app.schemas.orgs import OrgProfileResponse, OrgProfileUpdate
from app.schemas.posts import PostResponse
from app.security.rate_limit import rate_limited
from app.services.address import AddressClient, get_address_client
from app.services.instagram import InstagramClient, get_instagram_client
from app.services.instagram_lookup import lookup_instagram_handle
from app.services.onboarding import submit_org_onboarding
from app.services.org_apply import apply_org
from app.services.org_apply_prefill import get_live_prefill, prefill_to_public
from app.services.orgs import build_org_profile, get_org_for_user, update_org_profile
from app.services.posts import list_org_posts

router = APIRouter(prefix="/orgs", tags=["orgs"])


@router.post(
    "/apply",
    response_model=DataResponse[OrgOnboardingResponse],
    dependencies=[Depends(rate_limited("org_apply", limit=5, window=60))],
)
async def org_apply(
    payload: OrgApplyRequest,
    db: AsyncSession = Depends(get_db),
    addresses: AddressClient = Depends(get_address_client),
) -> APIResponse:
    """Public apply-first signup (no Instagram OAuth)."""
    result = await apply_org(db, payload, addresses)
    return api_response(data=OrgOnboardingResponse.model_validate(result))


@router.get(
    "/apply/prefill",
    response_model=DataResponse[OrgApplyPrefillResponse],
    dependencies=[Depends(rate_limited("org_apply_prefill", limit=10, window=60))],
)
async def org_apply_prefill(
    token: str = Query(min_length=1, max_length=128),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Public hashed apply draft. Does not consume the token."""
    row = await get_live_prefill(db, token)
    return api_response(data=OrgApplyPrefillResponse.model_validate(prefill_to_public(row)))


@router.get(
    "/instagram-lookup",
    response_model=DataResponse[InstagramLookupResponse],
    dependencies=[
        Depends(rate_limited("ig_lookup_burst", limit=10, window=60)),
        Depends(rate_limited("ig_lookup_hour", limit=30, window=3600)),
    ],
)
async def org_instagram_lookup(
    username: str = Query(min_length=1, max_length=64),
    ig: InstagramClient = Depends(get_instagram_client),
) -> APIResponse:
    """Exact-username Business Discovery lookup for the apply confirm card."""
    result = await lookup_instagram_handle(ig, username)
    return api_response(data=InstagramLookupResponse.model_validate(result))


@router.get(
    "/address-suggest",
    response_model=DataResponse[AddressSuggestResponse],
    dependencies=[
        # Per-keystroke Places autocomplete (750ms debounce), not click-to-search.
        Depends(rate_limited("addr_suggest_burst", limit=60, window=60)),
        Depends(rate_limited("addr_suggest_hour", limit=300, window=3600)),
    ],
)
async def org_address_suggest(
    q: str = Query(min_length=1, max_length=200),
    addresses: AddressClient = Depends(get_address_client),
) -> APIResponse:
    """US address autocomplete (server-side Google Places; empty in development)."""
    items = await addresses.suggest(q)
    return api_response(
        data=AddressSuggestResponse(
            suggestions=[AddressSuggestionItem(place_id=s.place_id, text=s.text) for s in items]
        )
    )


@router.get(
    "/address-preview",
    response_model=DataResponse[AddressPreviewResponse],
    dependencies=[
        Depends(rate_limited("addr_preview_burst", limit=20, window=60)),
        Depends(rate_limited("addr_preview_hour", limit=60, window=3600)),
    ],
)
async def org_address_preview(
    place_id: str = Query(alias="placeId", min_length=1, max_length=256),
    addresses: AddressClient = Depends(get_address_client),
) -> APIResponse:
    """Fill structured fields from a Places suggestion (re-validated on submit)."""
    addr = await addresses.preview(place_id)
    return api_response(
        data=AddressPreviewResponse(
            shipping_line1=addr.line1,
            shipping_line2=addr.line2,
            shipping_city=addr.city,
            shipping_state=addr.state,
            shipping_postal_code=addr.postal_code,
            delivery_address=addr.formatted,
        )
    )


@router.post("/onboarding", response_model=DataResponse[OrgOnboardingResponse])
async def org_onboarding(
    payload: OrgOnboardingRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ig: InstagramClient = Depends(get_instagram_client),
    addresses: AddressClient = Depends(get_address_client),
) -> APIResponse:
    """Phase 2: submit org profile, advance to email verification (Stage 7).

    Uses the bare authenticated user (not ``CurrentOrg``) because the caller is
    ``pending_org_profile``, not yet active — the active-status gate would 403.
    """
    result = await submit_org_onboarding(db, user, payload, ig=ig, addresses=addresses)
    return api_response(data=OrgOnboardingResponse.model_validate(result))


async def _require_org_profile(db: AsyncSession, user: User) -> Organization:
    org = await get_org_for_user(db, user)
    if org is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization profile not found.", status_code=404)
    return org


@router.get("/me", response_model=DataResponse[OrgProfileResponse])
async def get_my_org(
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Return the caller org's profile (JWT + ``org`` role + ``active``)."""

    org = await _require_org_profile(db, user)
    return api_response(data=build_org_profile(org, user))


@router.patch("/me", response_model=DataResponse[OrgProfileResponse])
async def update_my_org(
    payload: OrgProfileUpdate,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
    addresses: AddressClient = Depends(get_address_client),
) -> APIResponse:
    """Patch the editable subset of the caller org's profile."""

    org = await _require_org_profile(db, user)
    org = await update_org_profile(db, org, payload, addresses)
    return api_response(data=build_org_profile(org, user))


@router.get("/me/posts", response_model=DataResponse[list[PostResponse]])
async def list_my_posts(
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """The caller org's social posts + their campaign-link indicator (§7.4.2)."""

    return api_response(data=await list_org_posts(db, user))


@router.post("/me/posts/refresh", response_model=DataResponse[list[PostResponse]])
async def refresh_my_posts(
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Return the caller org's currently-stored posts.

    The canonical Instagram sync is the Stage 8 daily batch job
    (``app.jobs.metric_sync``, §10.1). This endpoint intentionally does NOT call
    Instagram on demand (it would burn rate-limit per click and add latency);
    it just returns the stored posts so the SPA's "Refresh" affordance reflects
    the latest synced metrics. A future single-org on-demand sync could hang
    here if needed.
    """

    return api_response(data=await list_org_posts(db, user))
