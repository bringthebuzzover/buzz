"""Public contact form (marketing contact modal).

Unauthenticated on purpose: anyone with a question should be able to reach
hello@ without an account. That makes it a spam target, so it carries two
independent cheap defences rather than a CAPTCHA dependency:

* **Per-IP rate limits** — a short burst bucket and a slow hourly bucket.
* **A honeypot field** — invisible to people and to assistive tech; anything in
  it is a bot.

Nothing is stored: the request becomes an ops notice (Reply-To set to the
sender) plus a copy back to the sender. See ``services.email``.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.response import APIResponse, DataResponse, api_response
from app.schemas.contact import ContactAccepted, ContactRequest
from app.security.rate_limit import rate_limited
from app.services import email

logger = logging.getLogger(__name__)

router = APIRouter(tags=["contact"])

# Two buckets, not one: the minute limit stops a burst (a refresh storm or a
# naive script), and the hourly limit stops a slow drip that would sit under it.
_CONTACT_LIMITS = [
    Depends(rate_limited("contact_minute", limit=5, window=60)),
    Depends(rate_limited("contact_hour", limit=20, window=3600)),
]


@router.post(
    "/contact",
    response_model=DataResponse[ContactAccepted],
    dependencies=_CONTACT_LIMITS,
)
async def submit_contact(payload: ContactRequest) -> APIResponse:
    """Accept a contact message and mail it to the team.

    A filled honeypot returns the **same success shape** without sending. That
    silence is deliberate: a distinct response would tell a bot which field to
    leave alone, and an operator chasing false positives gets nothing useful
    from a louder failure. The rejection is logged with no message body.

    The ack to the sender is best-effort. If it fails, the ops notice still
    stands and the person simply gets no copy — a normal, acceptable outcome,
    so it must not fail the request.
    """

    if payload.website.strip():
        logger.warning("contact_form_honeypot_rejected")
        return api_response(data=ContactAccepted())

    submitted_at = datetime.now(timezone.utc)
    contact_name = " ".join(part for part in (payload.first_name, payload.last_name) if part)
    # The message is part of the key: the same person sending different text is
    # a different message, while a double-submit cannot produce two sends.
    notice_key = email.build_idempotency_key(
        email.KIND_CONTACT, payload.email, submitted_at.isoformat()
    )

    await email.send_contact_notice(
        contact_name=contact_name,
        sender_email=payload.email,
        message=payload.message,
        submitted_at=submitted_at,
        idempotency_key=notice_key,
    )
    await email.send_contact_ack(
        to_email=payload.email,
        contact_name=payload.first_name,
        message=payload.message,
        idempotency_key=email.build_idempotency_key(
            email.KIND_CONTACT_ACK, payload.email, submitted_at.isoformat()
        ),
    )

    return api_response(data=ContactAccepted())
