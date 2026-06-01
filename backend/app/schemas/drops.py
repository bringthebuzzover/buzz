"""Pydantic models for the drops surface (architecture.md §5.5, §7.1).

The org drop-feed response is **camelCase** with **epoch-ms** datetimes so it
matches the frontend ``Drop`` TypeScript type field-for-field (the React feed
hook needs no remapping). Only the fields the org feed card actually renders are
exposed; brand/fulfillment fields (e.g. ``brandTrackerStage``, whose backend and
frontend enum vocabularies differ) are intentionally omitted until the Stage 5
brand surface reconciles them.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_serializer
from pydantic.alias_generators import to_camel


class DropFeedItem(BaseModel):
    """One drop as the org browse feed renders it (architecture §7.1).

    ``accepted_count`` and ``already_applied`` are server-computed: the former
    drives the "spots remaining"/full state, the latter is true when the caller
    org has a non-denied application on the drop (mirrors the demo's rule).
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: uuid.UUID
    brand_name: str
    title: str
    description: str
    image: str
    location: str
    capacity_total: int
    apply_open_at: datetime
    apply_close_at: datetime
    manual_reopen: bool
    accepted_count: int
    already_applied: bool

    @field_serializer("apply_open_at", "apply_close_at")
    def _serialize_epoch_ms(self, value: datetime) -> int:
        """Emit epoch milliseconds to match the frontend ``Drop`` number fields.

        Drop datetime columns are ``timezone=True`` so values are tz-aware; we
        defensively coerce a naive value to UTC so ``.timestamp()`` can't silently
        use the server's local offset.
        """

        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return int(value.timestamp() * 1000)
