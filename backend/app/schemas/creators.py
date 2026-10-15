"""Creator apply and review wire shapes."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import field_validator

from app.schemas.common import CamelModel


def _edu(value: str) -> str:
    cleaned = value.strip().lower()
    if len(cleaned) > 320 or cleaned.count("@") != 1:
        raise ValueError("Invalid email address")
    local, _, domain = cleaned.partition("@")
    if not local or not domain.endswith(".edu") or len(domain) <= len(".edu"):
        raise ValueError("Must be a valid .edu email address")
    return cleaned


class CreatorApplyRequest(CamelModel):
    name: str
    school: str
    city: str
    grad_year: str
    edu_email: str
    claimed_handle: str
    niches: list[str]
    bio: str
    tiktok_handle: str = ""
    open_to: list[str] = []

    @field_validator("edu_email")
    @classmethod
    def _validate_edu(cls, value: str) -> str:
        return _edu(value)

    @field_validator("name", "school", "city", "grad_year", "bio", "claimed_handle")
    @classmethod
    def _strip(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field is required")
        return cleaned


class CreatorApplyResponse(CamelModel):
    creator_id: str
    status: str
    email_sent_to: str
    email_sent: bool


class CreatorVerifyRequest(CamelModel):
    token: str


class CreatorStatusResponse(CamelModel):
    creator_id: str
    status: str


class CreatorPortfolioItemResponse(CamelModel):
    id: str
    title: str
    format: str
    source: str
    link: str | None
    image_url: str | None


class CreatorProfileResponse(CamelModel):
    id: str
    name: str
    school: str
    city: str
    grad_year: str
    edu_email: str
    claimed_handle: str
    instagram_connected: bool
    followers: int | None
    posts: int | None
    niches: list[str]
    bio: str
    tiktok_handle: str
    open_to: list[str]
    past_collab: str | None
    portfolio: list[CreatorPortfolioItemResponse]
    status: str


class CreatorPitchRequest(CamelModel):
    pitch: str


class CreatorDropPublishRequest(CamelModel):
    brand_id: uuid.UUID
    title: str
    description: str
    creator_cap: int
    creator_gross: int
    apply_open_at: datetime
    apply_close_at: datetime
    image_url: str | None = None


class CreatorPortfolioCreate(CamelModel):
    title: str
    link: str | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field is required")
        return cleaned

    @field_validator("link")
    @classmethod
    def _link(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None
