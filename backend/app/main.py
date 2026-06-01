"""FastAPI application entrypoint.

Wires the Stage 1 contract: CORS allowlist, the `{ data, meta, error }`
envelope via `BuzzAPIException` + unhandled-exception handlers, and the
liveness route. Docs are exposed under `/api/docs` and the spec at
`/api/openapi.json` so all backend surfaces share the same `/api` prefix.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import errors
from app.deps.db import engine
from app.exceptions import BuzzAPIException
from app.response import api_error_response
from app.routes.auth import router as auth_router
from app.routes.campaigns import router as campaigns_router
from app.routes.drops import router as drops_router
from app.routes.health import router as health_router
from app.routes.orgs import router as orgs_router
from app.services.instagram import close_instagram_client

logger = logging.getLogger(__name__)

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://bringthebuzzover.com",
    "https://www.bringthebuzzover.com",
]


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
app.include_router(drops_router, prefix="/api")
app.include_router(campaigns_router, prefix="/api")
