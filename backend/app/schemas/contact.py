"""Public contact-form request/response (marketing contact modal).

No persistence: a submission becomes two emails (ops notice + sender ack), so
there is deliberately no table and no migration behind this.
"""

from __future__ import annotations

from pydantic import ConfigDict, field_validator
from pydantic.alias_generators import to_camel

from app.schemas.common import CamelModel
from app.schemas.email_rules import clean_email_address

# Kept in step with the frontend fields; generous but bounded so a script cannot
# push arbitrary volume through the mail provider.
_NAME_LIMIT = 100
_MESSAGE_LIMIT = 2000


class ContactRequest(CamelModel):
    """``POST /api/contact`` body.

    ``website`` is a **honeypot**: a real browser never fills it because the
    field is visually hidden, off the tab order, and hidden from assistive
    tech. Anything in it is a bot, and the route answers success while sending
    nothing (see the route for why silence is deliberate).

    ``extra="forbid"`` is load-bearing here, not stylistic. Without it Pydantic
    silently ignores an unknown key, so a submission carrying ``Website`` or
    ``WEBSITE`` left the honeypot at its empty default, passed the guard, and
    sent both emails — a casing bypass of the spam check. Forbidding extras
    turns every unrecognised key into a 422, which sends nothing.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    first_name: str
    last_name: str = ""
    email: str
    message: str
    website: str = ""

    @field_validator("first_name", "last_name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        # ``contact_name`` is interpolated into the ops-notice **subject**, which
        # is a header value, so a control character here is the same
        # header-injection surface as the email field. No legitimate name
        # contains one, so it is dropped rather than surfaced as another error.
        cleaned = "".join(ch for ch in value if ord(ch) >= 0x20 and ord(ch) != 0x7F)
        return cleaned.strip()[:_NAME_LIMIT]

    @field_validator("first_name")
    @classmethod
    def _require_first_name(cls, value: str) -> str:
        if not value:
            raise ValueError("First name is required")
        return value

    @field_validator("email")
    @classmethod
    def _valid_email(cls, value: str) -> str:
        # This address becomes Resend's ``reply_to`` and the ``To:`` of the ack,
        # so the rule has to be strict about what can appear in a header: one
        # mailbox, no CRLF, no comma list, no whitespace. See
        # ``app.schemas.email_rules`` (which also enforces the 320-char bound).
        return clean_email_address(value)

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
