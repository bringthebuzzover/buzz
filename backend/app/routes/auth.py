"""Auth routes — ``/api/auth/*`` (architecture.md §5.1).

Covers the org Instagram OAuth handshake plus the shared session surface
(``/refresh``, ``/logout``, ``/me``). All JSON responses use the standard
``{ data, meta, error }`` envelope; the refresh token rides an httpOnly cookie.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Form, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.config import settings
from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus, PortalRole
from app.models.user import User
from app.response import APIResponse, api_response
from app.schemas.auth import (
    DevLoginRequest,
    InstagramCallbackRequest,
    RefreshResponse,
    TokenResponse,
)
from app.schemas.common import camelize
from app.schemas.onboarding import (
    AdminLoginRequest,
    BrandLoginRequest,
    BrandSetPasswordRequest,
    ResendVerificationRequest,
    VerifyEmailRequest,
)
from app.security import jwt
from app.security.rate_limit import enforce_account_limit, rate_limited
from app.security.signed_request import SignedRequestError, parse_signed_request
from app.services.admin_auth import login_admin
from app.services.auth import (
    build_user_response,
    handle_instagram_callback,
    issue_token_pair,
    revoke_instagram_authorization,
)
from app.services.brand_auth import login_brand, set_brand_password
from app.services.instagram import InstagramClient, get_instagram_client
from app.services.onboarding import resend_verification_email, verify_email

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=token,
        max_age=settings.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
    )


def _set_state_cookie(response: Response, state: str) -> None:
    response.set_cookie(
        key=settings.OAUTH_STATE_COOKIE_NAME,
        value=state,
        max_age=settings.OAUTH_STATE_TTL_MINUTES * 60,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
    )


def _clear_state_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.OAUTH_STATE_COOKIE_NAME,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
    )


@router.get("/instagram/login")
async def instagram_login(
    ig: InstagramClient = Depends(get_instagram_client),
) -> RedirectResponse:
    """Redirect (302) to the Instagram OAuth authorize URL (§3.4 Phase 1).

    The signed ``state`` is also stored in a short-lived httpOnly cookie so the
    callback can prove the round-trip belongs to the same browser that started
    it (double-submit; defends against OAuth login-CSRF / session fixation,
    architecture §11.1). No server-side state store is needed.
    """

    state = jwt.create_oauth_state_token()
    redirect = RedirectResponse(ig.build_authorize_url(state), status_code=302)
    _set_state_cookie(redirect, state)
    return redirect


@router.post(
    "/instagram/callback",
    response_model=APIResponse,
    dependencies=[Depends(rate_limited("ig_callback", limit=20, window=60))],
)
async def instagram_callback(
    payload: InstagramCallbackRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    ig: InstagramClient = Depends(get_instagram_client),
) -> APIResponse:
    """Exchange the OAuth code, upsert the org user, issue Buzz tokens."""

    # Bind the state to this browser: the cookie set at /login must be present
    # and exactly match the submitted state, AND the state must verify (sig +
    # type + not expired). Either failure → 401, never partially trusting one.
    cookie_state = request.cookies.get(settings.OAUTH_STATE_COOKIE_NAME)
    state_ok = bool(cookie_state) and cookie_state == payload.state
    if state_ok:
        try:
            jwt.decode_token(payload.state, expected_type=jwt.OAUTH_STATE_TOKEN_TYPE)
        except jwt.TokenError:
            state_ok = False
    if not state_ok:
        _clear_state_cookie(response)
        raise BuzzAPIException(
            code=errors.UNAUTHORIZED,
            message="Invalid or expired OAuth state.",
            status_code=401,
        )
    _clear_state_cookie(response)

    user = await handle_instagram_callback(db, ig, payload.code)
    # Don't mint fresh credentials for a terminally-denied/suspended account —
    # symmetric with the refresh boundary (refresh already rejects these). New
    # users are pending_org_profile, so signup is unaffected.
    if user.status in {OrgUserStatus.DENIED.value, OrgUserStatus.SUSPENDED.value}:
        raise BuzzAPIException(
            code=errors.FORBIDDEN,
            message="This account is not permitted to sign in.",
            status_code=403,
        )
    access, refresh = issue_token_pair(user)
    _set_refresh_cookie(response, refresh)
    return api_response(data=TokenResponse(access_token=access, user=build_user_response(user)))


@router.post(
    "/instagram/deauthorize",
    response_model=APIResponse,
    dependencies=[Depends(rate_limited("ig_deauth", limit=60, window=60))],
)
async def instagram_deauthorize(
    signed_request: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Meta deauthorize webhook (public, unauthenticated, HMAC-verified).

    Meta POSTs ``signed_request`` (application/x-www-form-urlencoded) when a
    user removes our app from their Instagram. We verify the signature with
    ``INSTAGRAM_CLIENT_SECRET`` and, if the payload's ``user_id`` matches a
    known org user, drop their token and bump ``token_version`` to kill any
    live sessions. The user row itself is preserved — account deletion is a
    separate flow (see ``/data-deletion``).
    """

    if not signed_request:
        raise BuzzAPIException(
            code=errors.VALIDATION_ERROR,
            message="Missing signed_request.",
            status_code=400,
        )
    try:
        payload = parse_signed_request(signed_request, settings.INSTAGRAM_CLIENT_SECRET)
    except SignedRequestError as exc:
        raise BuzzAPIException(
            code=errors.UNAUTHORIZED,
            message="Invalid signed_request.",
            status_code=401,
        ) from exc

    if user_id := payload.get("user_id"):
        await revoke_instagram_authorization(db, str(user_id))
    return api_response(data={"ok": True})


@router.post(
    "/refresh",
    response_model=APIResponse,
    dependencies=[Depends(rate_limited("refresh", limit=60, window=60))],
)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Issue a new access token from the refresh cookie; rotate the cookie."""

    cookie = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if not cookie:
        raise BuzzAPIException(
            code=errors.UNAUTHORIZED, message="Missing refresh token.", status_code=401
        )
    try:
        payload = jwt.decode_token(cookie, expected_type=jwt.REFRESH_TOKEN_TYPE)
    except jwt.TokenError as exc:
        raise BuzzAPIException(
            code=errors.UNAUTHORIZED,
            message="Invalid or expired refresh token.",
            status_code=401,
        ) from exc

    try:
        user_id = uuid.UUID(payload.sub)
    except ValueError as exc:
        raise BuzzAPIException(
            code=errors.UNAUTHORIZED, message="Invalid refresh token.", status_code=401
        ) from exc

    user = await db.get(User, user_id)
    if user is None:
        raise BuzzAPIException(
            code=errors.UNAUTHORIZED, message="User no longer exists.", status_code=401
        )

    # Cut off terminal accounts at the refresh boundary (defense-in-depth).
    # Onboarding states (pending_*) are intentionally allowed — those users
    # are non-active but still need a live session to finish onboarding.
    if user.status in {OrgUserStatus.SUSPENDED.value, OrgUserStatus.DENIED.value}:
        raise BuzzAPIException(
            code=errors.UNAUTHORIZED,
            message="This account can no longer refresh its session.",
            status_code=401,
        )

    # Revocation: a refresh token is only valid while its `ver` matches the
    # user's current token_version. Logout / admin-deny bump the version,
    # invalidating every outstanding refresh token (§11.1). Tokens minted before
    # this field existed carry no `ver`; treat that as version 0.
    if (payload.ver or 0) != (user.token_version or 0):
        raise BuzzAPIException(
            code=errors.UNAUTHORIZED,
            message="This session has been revoked. Please sign in again.",
            status_code=401,
        )

    access, new_refresh = issue_token_pair(user)
    _set_refresh_cookie(response, new_refresh)
    return api_response(data=RefreshResponse(access_token=access))


@router.post("/logout", response_model=APIResponse)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Log out: revoke outstanding refresh tokens and clear the cookie.

    Bumping ``token_version`` invalidates every refresh token the user holds
    (not just the cookie being cleared), so a stolen/duplicated refresh token
    can no longer be exchanged. Always succeeds and clears the cookie, even if
    the presented token is missing/expired/garbage (nothing to revoke then).
    """

    cookie = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if cookie:
        try:
            payload = jwt.decode_token(cookie, expected_type=jwt.REFRESH_TOKEN_TYPE)
            user = await db.get(User, uuid.UUID(payload.sub))
            if user is not None:
                user.token_version = (user.token_version or 0) + 1
                await db.flush()
        except (jwt.TokenError, ValueError):
            pass  # nothing valid to revoke; just clear the cookie

    _clear_refresh_cookie(response)
    return api_response(data={"ok": True})


@router.get("/me", response_model=APIResponse)
async def me(user: User = Depends(get_current_user)) -> APIResponse:
    """Return the current user (no status gate; onboarding pages call this)."""

    return api_response(data=build_user_response(user))


@router.post(
    "/dev-login",
    response_model=APIResponse,
    dependencies=[Depends(rate_limited("dev_login", limit=20, window=60))],
)
async def dev_login(
    payload: DevLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Dev-only shortcut to mint a real session without the Instagram flow.

    Local dev has no Meta credentials and the SPA has no login UI yet (Stage 6),
    so the Stage 4 vertical slice needs a way to obtain a token. This issues the
    same token pair + refresh cookie as the real flow, but only when
    ``ENVIRONMENT == "development"`` — outside dev it 404s (invisible).
    """

    if settings.ENVIRONMENT != "development":
        raise BuzzAPIException(code=errors.NOT_FOUND, message="Not found.", status_code=404)

    if payload.user_id is not None:
        user = await db.get(User, payload.user_id)
    elif payload.instagram_user_id is not None:
        user = await db.scalar(
            select(User).where(User.instagram_user_id == payload.instagram_user_id)
        )
    else:
        # Default: the first seeded active org user.
        user = await db.scalar(
            select(User)
            .where(
                User.portal_role == PortalRole.ORG.value,
                User.status == OrgUserStatus.ACTIVE.value,
            )
            .order_by(User.created_at.asc())
        )

    if user is None:
        raise BuzzAPIException(code=errors.NOT_FOUND, message="No matching user.", status_code=404)

    access, refresh = issue_token_pair(user)
    _set_refresh_cookie(response, refresh)
    return api_response(data=TokenResponse(access_token=access, user=build_user_response(user)))


# ── Org onboarding (Stage 7) ────────────────────────────────────────────────


@router.post(
    "/verify-email",
    response_model=APIResponse,
    dependencies=[Depends(rate_limited("verify_email", limit=20, window=60))],
)
async def verify_email_endpoint(
    payload: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Phase 3: consume a one-time .edu verification token (rate-limited: token guessing)."""
    result = await verify_email(db, payload.token)
    return api_response(data=camelize(result))


@router.post(
    "/verify-email/resend",
    response_model=APIResponse,
    dependencies=[Depends(rate_limited("verify_resend", limit=3, window=60))],
)
async def resend_verification_endpoint(
    _payload: ResendVerificationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Re-send the .edu verification email (rate-limited, auth required)."""
    result = await resend_verification_email(db, user)
    return api_response(data=camelize(result))


# ── Brand auth (Stage 7) ────────────────────────────────────────────────────


@router.post("/brand/set-password", response_model=APIResponse)
async def brand_set_password(
    payload: BrandSetPasswordRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Consume a brand invite token, set the password, and start a session.

    Returns the same ``TokenResponse`` as login so the SPA lands the brand in
    their portal without a separate login step.
    """
    user, user_resp = await set_brand_password(db, payload.token, payload.password)
    access, refresh = issue_token_pair(user)
    _set_refresh_cookie(response, refresh)
    return api_response(data=TokenResponse(access_token=access, user=user_resp))


@router.post(
    "/brand/login",
    response_model=APIResponse,
    dependencies=[Depends(rate_limited("brand_login", limit=10, window=60))],
)
async def brand_login(
    payload: BrandLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Brand email + password login. Issues JWT tokens on success.

    Rate-limited per-IP (decorator) and per-account (below) — the per-account cap
    runs *before* the bcrypt verify so credential-stuffing across rotating IPs
    can't burn CPU. The cap is generous so a third party can't easily lock out a
    brand by hammering its email.
    """
    enforce_account_limit("brand_login", payload.email.strip().lower(), limit=20, window=300)
    user, user_resp = await login_brand(db, payload.email, payload.password)
    access, refresh = issue_token_pair(user)
    _set_refresh_cookie(response, refresh)
    return api_response(data=TokenResponse(access_token=access, user=user_resp))


# ── Admin auth ──────────────────────────────────────────────────────────────


@router.post(
    "/admin/login",
    response_model=APIResponse,
    dependencies=[Depends(rate_limited("admin_login", limit=10, window=60))],
)
async def admin_login(
    payload: AdminLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> APIResponse:
    """Admin email + password login — the only admin session entry point.

    Admins have neither an Instagram identity nor an invite flow, so without
    this they are unreachable outside local dev (``dev-login`` 404s off-dev).
    Rate-limited per-IP and per-account like the brand path.
    """
    enforce_account_limit("admin_login", payload.email.strip().lower(), limit=20, window=300)
    user, user_resp = await login_admin(db, payload.email, payload.password)
    access, refresh = issue_token_pair(user)
    _set_refresh_cookie(response, refresh)
    return api_response(data=TokenResponse(access_token=access, user=user_resp))
