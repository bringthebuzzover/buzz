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
        v = v.strip()
        if not v:
            raise ValueError("Must not be empty")
        # Bound to the column width (String(255)) so overlong input is a clean
        # 422, not a DB DataError -> 500.
        if len(v) > 255:
            raise ValueError("Must be 255 characters or fewer")
        return v

    @field_validator("details")
    @classmethod
    def _details_bound(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 5000:
            raise ValueError("Must be 5000 characters or fewer")
        return v
