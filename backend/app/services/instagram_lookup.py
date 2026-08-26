"""Cached public Instagram handle lookup (Business Discovery)."""

from __future__ import annotations

import asyncio
import time
from typing import Any

from app import errors
from app.exceptions import BuzzAPIException
from app.services.instagram import InstagramClient, canonical_instagram_handle

_CACHE_TTL_SECONDS = 15 * 60
_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_inflight: dict[str, asyncio.Future[dict[str, Any]]] = {}


def _cache_get(key: str) -> dict[str, Any] | None:
    row = _cache.get(key)
    if row is None:
        return None
    expires, payload = row
    if expires < time.monotonic():
        _cache.pop(key, None)
        return None
    return payload


def _cache_set(key: str, payload: dict[str, Any]) -> None:
    _cache[key] = (time.monotonic() + _CACHE_TTL_SECONDS, payload)


def clear_instagram_lookup_cache() -> None:
    """Test helper."""
    _cache.clear()
    _inflight.clear()


async def lookup_instagram_handle(ig: InstagramClient, username: str) -> dict[str, Any]:
    """Return confirm-card payload; soft-fail when Meta/token unavailable."""
    handle = canonical_instagram_handle(username)
    if not handle:
        return {
            "available": False,
            "username": None,
            "name": None,
            "profile_picture_url": None,
            "biography": None,
            "followers_count": None,
            "reason": "not_found",
        }

    key = handle.lower()
    cached = _cache_get(key)
    if cached is not None:
        return cached

    existing = _inflight.get(key)
    if existing is not None:
        return await existing

    loop = asyncio.get_running_loop()
    fut: asyncio.Future[dict[str, Any]] = loop.create_future()
    _inflight[key] = fut
    try:
        result = await _do_lookup(ig, handle)
        _cache_set(key, result)
        fut.set_result(result)
        return result
    except Exception as exc:  # noqa: BLE001
        if not fut.done():
            fut.set_exception(exc)
        raise
    finally:
        _inflight.pop(key, None)


async def _do_lookup(ig: InstagramClient, handle: str) -> dict[str, Any]:
    try:
        profile = await ig.fetch_business_discovery(handle)
    except BuzzAPIException as exc:
        if exc.code == errors.RATE_LIMITED:
            return {
                "available": False,
                "username": handle,
                "name": None,
                "profile_picture_url": None,
                "biography": None,
                "followers_count": None,
                "reason": "throttled",
            }
        return {
            "available": False,
            "username": handle,
            "name": None,
            "profile_picture_url": None,
            "biography": None,
            "followers_count": None,
            "reason": "unavailable",
        }

    if profile is None:
        return {
            "available": False,
            "username": handle,
            "name": None,
            "profile_picture_url": None,
            "biography": None,
            "followers_count": None,
            "reason": "not_found",
        }

    return {
        "available": True,
        "username": profile.username,
        "name": profile.name,
        "profile_picture_url": profile.profile_picture_url,
        "biography": profile.biography,
        "followers_count": profile.followers_count,
        "reason": None,
    }
