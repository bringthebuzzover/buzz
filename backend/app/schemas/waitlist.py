"""Public waitlist schemas (architecture.md §9.2)."""

from __future__ import annotations

from pydantic import field_validator

from app.schemas.common import CamelModel


class WaitlistSubmitRequest(CamelModel):
    submitter_name: str
    entity_name: str
    email: str
    entity_type: str
    details: str | None = None

    @field_validator("email")
    @classmethod
    def _validate_email(cls, v: str) -> str:
        # Use pydantic's EmailStr-like basic validation without requiring the
        # email-validator package. Reject obviously malformed addresses.
        if "@" not in v or len(v) > 320:
            raise ValueError("Invalid email address")
        return v

    @field_validator("entity_type")
    @classmethod
    def _validate_entity_type(cls, v: str) -> str:
        if v not in ("brand", "org"):
            raise ValueError("entity_type must be 'brand' or 'org'")
        return v

    @field_validator("submitter_name", "entity_name")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Must not be empty")
        return v.strip()
