"""Creator apply and review wire shapes."""

from __future__ import annotations

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
