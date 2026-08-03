"""FastAPI application entrypoint.

Wires the Stage 1 contract: CORS allowlist, the `{ data, meta, error }`
envelope via `BuzzAPIException` + unhandled-exception handlers, and the
liveness route. Docs are exposed under `/api/docs` and the spec at
`/api/openapi.json` so all backend surfaces share the same `/api` prefix.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response

from app import errors
from app.config import settings
from app.deps.db import engine
from app.exceptions import BuzzAPIException
from app.response import api_error_response
from app.routes.admin import router as admin_router
from app.routes.auth import router as auth_router
from app.routes.brands import router as brands_router
from app.routes.campaigns import router as campaigns_router
from app.routes.drops import router as drops_router
from app.routes.health import router as health_router
from app.routes.orgs import router as orgs_router
from app.services.instagram import close_instagram_client

logger = logging.getLogger(__name__)

_STATIC_PROD_ORIGINS = [
    "https://bringthebuzzover.com",
    "https://www.bringthebuzzover.com",
]


def _allowed_origins() -> list[str]:
    """Exact-origin CORS allowlist (credentials require no wildcards).

    Always includes the static production hosts. Also includes
    ``FRONTEND_URL``'s origin so temporary Railway ``*.up.railway.app``
    hosts work before custom DNS is wired.
    """

    origins = list(_STATIC_PROD_ORIGINS)
    parsed = urlparse(settings.FRONTEND_URL)
    if parsed.scheme and parsed.netloc:
        frontend_origin = f"{parsed.scheme}://{parsed.netloc}"
        if frontend_origin not in origins:
            origins.append(frontend_origin)
    if settings.ENVIRONMENT == "development":
        origins.append("http://localhost:3000")
    return origins


ALLOWED_ORIGINS = _allowed_origins()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Dispose the async engine cleanly on shutdown."""

    try:
        yield
    finally:
        await close_instagram_client()
        await engine.dispose()


app = FastAPI(
    title="Buzz API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _security_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Baseline hardening headers on every response (§11, Stage 9).

    Cheap defense-in-depth for an API behind a SPA: no MIME sniffing, deny
    framing, and HSTS (off in dev where there's no HTTPS). A page CSP belongs on
    the static frontend host, not the API.
    """
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if settings.ENVIRONMENT != "development":
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    return response


@app.exception_handler(BuzzAPIException)
async def buzz_exception_handler(
    request: Request,
    exc: BuzzAPIException,
) -> JSONResponse:
    """Serialize typed domain failures as the standard error envelope."""

    payload = api_error_response(
        code=exc.code,
        message=exc.message,
        details=exc.details,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=payload.model_dump(),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Return request-validation failures in the standard error envelope.

    FastAPI's default 422 body is ``{ "detail": [...] }``, which bypasses the
    ``{ data, meta, error }`` contract — the frontend branches on ``error.code``
    (§5.2), so emit ``VALIDATION_ERROR`` with the raw errors under ``details``.
    """

    payload = api_error_response(
        code=errors.VALIDATION_ERROR,
        message="Request validation failed.",
        details={"errors": jsonable_encoder(exc.errors())},
    )
    return JSONResponse(status_code=422, content=payload.model_dump())


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    """Wrap framework HTTP errors (unknown route 404, method 405) in the envelope.

    Without this, FastAPI's default body is ``{"detail": "..."}``, which bypasses
    the ``{ data, meta, error }`` contract the frontend branches on (§5.2).
    ``BuzzAPIException`` has its own handler; this only catches the framework's
    own ``HTTPException`` (raised for routing failures, not by our handlers).
    """

    code = errors.NOT_FOUND if exc.status_code == 404 else errors.HTTP_ERROR
    message = exc.detail if isinstance(exc.detail, str) else "Request failed."
    payload = api_error_response(code=code, message=message)
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump())


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Last-resort handler: log the trace, return INTERNAL_ERROR (hide internals)."""

    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    payload = api_error_response(
        code=errors.INTERNAL_ERROR,
        message="Something went wrong on our side.",
    )
    return JSONResponse(status_code=500, content=payload.model_dump())


app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(orgs_router, prefix="/api")
app.include_router(brands_router, prefix="/api")
app.include_router(drops_router, prefix="/api")
app.include_router(campaigns_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
