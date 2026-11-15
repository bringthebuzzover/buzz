"""Public contact-form request/response (marketing contact modal).

No persistence: a submission becomes two emails (ops notice + sender ack), so
there is deliberately no table and no migration behind this.
"""

from __future__ import annotations

from pydantic import field_validator

from app.schemas.common import CamelModel

# Kept in step with the frontend fields; generous but bounded so a script cannot
# push arbitrary volume through the mail provider.
_NAME_LIMIT = 100
_EMAIL_LIMIT = 320
_MESSAGE_LIMIT = 2000


class ContactRequest(CamelModel):
    """``POST /api/contact`` body.

    ``website`` is a **honeypot**: a real browser never fills it because the
    field is visually hidden, off the tab order, and hidden from assistive
    tech. Anything in it is a bot, and the route answers success while sending
    nothing (see the route for why silence is deliberate).
    """

    first_name: str
    last_name: str = ""
    email: str
    message: str
    website: str = ""

    @field_validator("first_name", "last_name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        return value.strip()[:_NAME_LIMIT]

    @field_validator("first_name")
    @classmethod
    def _require_first_name(cls, value: str) -> str:
        if not value:
            raise ValueError("First name is required")
        return value

    @field_validator("email")
    @classmethod
    def _valid_email(cls, value: str) -> str:
        # Same deliberately simple rule as the brand application: one '@', a dot
        # in the domain, bounded length. Deliverability is Resend's problem.
        cleaned = value.strip().lower()
        if "@" not in cleaned or "." not in cleaned.split("@")[-1] or len(cleaned) > _EMAIL_LIMIT:
            raise ValueError("Invalid email address")
        return cleaned

    @field_validator("message")
    @classmethod
    def _require_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Message is required")
        if len(cleaned) > _MESSAGE_LIMIT:
            raise ValueError(f"Message must be at most {_MESSAGE_LIMIT} characters")
        return cleaned


class ContactAccepted(CamelModel):
    """Response body. Deliberately says nothing about delivery internals."""

    accepted: bool = True
