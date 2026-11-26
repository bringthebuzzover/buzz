"""Discovery source shared by contact and self-service signup requests."""

from enum import StrEnum
from typing import Annotated

from pydantic import Field, StringConstraints, ValidationInfo, field_validator

from app.schemas.common import CamelModel


class HowFoundSource(StrEnum):
    LINKEDIN = "linkedin"
    INSTAGRAM = "instagram"
    REFERRAL = "referral"
    SEARCH_ENGINE = "search_engine"
    OTHER = "other"

    @property
    def label(self) -> str:
        return {
            self.LINKEDIN: "LinkedIn",
            self.INSTAGRAM: "Instagram",
            self.REFERRAL: "Referral",
            self.SEARCH_ENGINE: "Search engine",
            self.OTHER: "Other",
        }[self]


class HowFoundRequest(CamelModel):
    how_found: HowFoundSource
    how_found_other: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] | None
    ) = Field(default=None, validate_default=True)

    @field_validator("how_found_other")
    @classmethod
    def _validate_other(cls, value: str | None, info: ValidationInfo) -> str | None:
        source = info.data.get("how_found")
        if source == HowFoundSource.OTHER:
            if not value:
                raise ValueError("Tell us how you found BUZZ.")
            if any(ord(char) < 32 or ord(char) == 127 for char in value):
                raise ValueError("Enter your answer on one line.")
        elif value is not None:
            raise ValueError("Choose Other to enter a custom answer.")
        return value
