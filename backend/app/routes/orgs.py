"""Org profile routes — ``/api/orgs`` (architecture.md §5.1).

``POST /api/orgs/onboarding`` (Stage 7) creates the org profile and advances the
account to email verification; the rest is the active-org profile read/update +
posts surface.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.deps.auth import CurrentOrg, get_current_user
from app.deps.db import get_db
from app.exceptions import BuzzAPIException
from app.models.organization import Organization
from app.models.user import User
from app.response import APIResponse, api_response
from app.schemas.common import camelize
from app.schemas.onboarding import OrgOnboardingRequest
from app.schemas.orgs import OrgProfileUpdate
from app.services.onboarding import submit_org_onboarding
from app.services.orgs import build_org_profile, get_org_for_user, update_org_profile
from app.services.posts import list_org_posts

router = APIRouter(prefix="/orgs", tags=["orgs"])


@router.post("/onboarding", response_model=APIResponse)
async def org_onboarding(
    payload: OrgOnboardingRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Phase 2: submit org profile, advance to email verification (Stage 7).

    Uses the bare authenticated user (not ``CurrentOrg``) because the caller is
    ``pending_org_profile``, not yet active — the active-status gate would 403.
    """
    result = await submit_org_onboarding(db, user, payload)
    return api_response(data=camelize(result))


async def _require_org_profile(db: AsyncSession, user: User) -> Organization:
    org = await get_org_for_user(db, user)
    if org is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization profile not found.", status_code=404)
    return org


@router.get("/me", response_model=APIResponse)
async def get_my_org(
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Return the caller org's profile (JWT + ``org`` role + ``active``)."""

    org = await _require_org_profile(db, user)
    return api_response(data=build_org_profile(org))


@router.patch("/me", response_model=APIResponse)
async def update_my_org(
    payload: OrgProfileUpdate,
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Patch the editable subset of the caller org's profile."""

    org = await _require_org_profile(db, user)
    org = await update_org_profile(db, org, payload)
    return api_response(data=build_org_profile(org))


@router.get("/me/posts", response_model=APIResponse)
async def list_my_posts(
    user: CurrentOrg,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """The caller org's social posts + their campaign-link indicator (§7.4.2)."""

    return api_response(data=await list_org_posts(db, user))


@router.post("/me/posts/refresh", response_model=APIResponse)
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
