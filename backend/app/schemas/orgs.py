"""Pydantic models for the org profile surface (architecture.md §5.1, §3.1).

``GET /api/orgs/me`` returns the full org profile; ``PATCH /api/orgs/me`` accepts
the editable subset (``edu_email``/``approved_at``/timestamps are not editable
here — email changes go through verification in Stage 7).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import ConfigDict, field_serializer, field_validator
from pydantic.alias_generators import to_camel

from app.models.enums import OrgCategory
from app.schemas.common import CamelModel, to_epoch_ms


class OrgProfileResponse(CamelModel):
    """An org's own profile (architecture §3.1 ``organizations``)."""

    id: uuid.UUID
    org_name: str
    university: str
    edu_email: str
    instagram_handle: str
    tiktok_handle: str | None
    follower_count: int | None
    member_count: int | None
    category: str | None
    city: str | None
    state: str | None
    contact_name: str | None
    delivery_address: str | None
    approved_at: datetime | None
    created_at: datetime

    @field_serializer("approved_at", "created_at")
    def _epoch(self, value: datetime | None) -> int | None:
        return to_epoch_ms(value)


class OrgProfileUpdate(CamelModel):
    """Editable subset of the org profile (all optional; PATCH semantics).

    Only provided fields are applied (``model_dump(exclude_unset=True)``).
    ``edu_email`` and ``instagram_handle`` are intentionally absent — edu is
    the verified login identity; the IG handle mirrors the OAuth username and
    is not separately choosable.
    ``extra="forbid"`` so an unknown/typo'd key (or an attempt to send
    ``eduEmail`` / ``instagramHandle``) is a 422 rather than a silently-ignored
    no-op write.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    # Fields backed by NOT-NULL columns: explicit ``null`` is rejected (it would
    # otherwise flush an IntegrityError → 500). Omitting them is still fine.
    org_name: str | None = None
    university: str | None = None
    # Genuinely-nullable columns: sending ``null`` is an intentional "clear".
    tiktok_handle: str | None = None
    follower_count: int | None = None
    member_count: int | None = None
    category: OrgCategory | None = None
    city: str | None = None
    state: str | None = None
    contact_name: str | None = None
    delivery_address: str | None = None

    @field_validator("org_name", "university")
    @classmethod
    def _required_non_blank(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("must not be null")
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("tiktok_handle", "city", "state", "contact_name", "delivery_address")
    @classmethod
    def _optional_non_blank(cls, value: str | None) -> str | None:
        if value is not None:
            value = value.strip()
            if not value:
                raise ValueError("must not be blank")
        return value

    @field_validator("follower_count", "member_count")
    @classmethod
    def _non_negative(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("must be non-negative")
        return value
