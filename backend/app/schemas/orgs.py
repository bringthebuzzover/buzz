"""Pydantic models for the org profile surface (architecture.md §5.1, §3.1).

``GET /api/orgs/me`` returns the full org profile; ``PATCH /api/orgs/me`` accepts
the editable subset. ``edu_email`` and ``instagram_handle`` on the response are
projected from ``users`` (login identity) — they are not editable here (email
changes go through verification; IG handle tracks the OAuth username).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import ConfigDict, field_serializer, field_validator, model_validator
from pydantic.alias_generators import to_camel

from app.models.enums import OrgCategory
from app.schemas.common import CamelModel, to_epoch_ms


class OrgProfileResponse(CamelModel):
    """Org profile wire shape. ``edu_email`` / ``instagram_handle`` come from ``users``."""

    id: uuid.UUID
    org_name: str
    university: str
    edu_email: str
    pending_edu_email: str | None = None
    instagram_handle: str
    tiktok_handle: str | None
    follower_count: int | None
    member_count: int | None
    category: str | None
    city: str | None
    state: str | None
    contact_name: str | None
    delivery_address: str | None
    shipping_line1: str | None = None
    shipping_line2: str | None = None
    shipping_city: str | None = None
    shipping_state: str | None = None
    shipping_postal_code: str | None = None
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
    ``follower_count`` is Graph-owned (omit from PATCH; ``extra=forbid``).
    Profile fields that are required on create cannot be cleared to null/blank
    when sent; omit leaves the prior value (legacy nulls persist until filled).
    ``extra="forbid"`` so an unknown/typo'd key (or an attempt to send
    ``eduEmail`` / ``instagramHandle`` / ``followerCount``) is a 422 rather than
    a silently-ignored no-op write.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    # Fields that cannot be cleared when present in the body.
    org_name: str | None = None
    university: str | None = None
    member_count: int | None = None
    category: OrgCategory | None = None
    city: str | None = None
    state: str | None = None
    contact_name: str | None = None
    shipping_line1: str | None = None
    shipping_line2: str | None = None
    shipping_city: str | None = None
    shipping_state: str | None = None
    shipping_postal_code: str | None = None
    shipping_place_id: str | None = None
    # Genuinely optional / clearable.
    tiktok_handle: str | None = None

    @field_validator(
        "org_name",
        "university",
        "city",
        "state",
        "contact_name",
        "shipping_line1",
        "shipping_city",
        "shipping_state",
        "shipping_postal_code",
    )
    @classmethod
    def _required_non_blank(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("must not be null")
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("tiktok_handle")
    @classmethod
    def _optional_non_blank(cls, value: str | None) -> str | None:
        if value is not None:
            value = value.strip()
            if not value:
                raise ValueError("must not be blank")
        return value

    @field_validator("shipping_line2", "shipping_place_id")
    @classmethod
    def _optional_shipping(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("member_count")
    @classmethod
    def _member_count(cls, value: int | None) -> int | None:
        if value is None:
            raise ValueError("must not be null")
        if value < 0:
            raise ValueError("must be non-negative")
        return value

    @field_validator("category")
    @classmethod
    def _category_required(cls, value: OrgCategory | None) -> OrgCategory | None:
        if value is None:
            raise ValueError("must not be null")
        return value

    @model_validator(mode="after")
    def _shipping_together(self) -> "OrgProfileUpdate":
        keys = {
            "shipping_line1",
            "shipping_line2",
            "shipping_city",
            "shipping_state",
            "shipping_postal_code",
            "shipping_place_id",
        }
        if not (self.model_fields_set & keys):
            return self
        if not (
            self.shipping_line1
            and self.shipping_city
            and self.shipping_state
            and self.shipping_postal_code
        ):
            raise ValueError("shipping street, city, state, and ZIP are required together")
        return self
