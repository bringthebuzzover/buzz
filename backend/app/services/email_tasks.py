"""Defer request email delivery until after get_db commits and the response is sent."""

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import BackgroundTasks

logger = logging.getLogger(__name__)


async def schedule_email(
    background_tasks: BackgroundTasks | None,
    sender: Callable[..., Awaitable[bool]],
    *args: Any,
    **kwargs: Any,
) -> bool:
    """Return queued status for requests, or delivery status for scripts and jobs."""
    if background_tasks is None:
        return await sender(*args, **kwargs)

    async def deliver() -> None:
        try:
            if not await sender(*args, **kwargs):
                logger.warning("Background email delivery failed")
        except Exception:
            logger.exception("Background email delivery failed")

    background_tasks.add_task(deliver)
    return True
