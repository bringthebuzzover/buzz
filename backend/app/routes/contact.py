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

import hashlib
import logging

from fastapi import APIRouter, Depends

from app import errors
from app.exceptions import BuzzAPIException
from app.response import APIResponse, DataResponse, api_response
from app.schemas.contact import ContactAccepted, ContactRequest
from app.schemas.email_rules import mailbox_identity
from app.security.rate_limit import enforce_account_limit, rate_limited
from app.services import email

logger = logging.getLogger(__name__)

router = APIRouter(tags=["contact"])

# Two buckets, not one: the minute limit stops a burst (a refresh storm or a
# naive script), and the hourly limit stops a slow drip that would sit under it.
# Distinct names on purpose — a shared bucket name would collapse them into one
# counter and the second limit would never bind.
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

    The two sends are **not** symmetric. If the ops notice fails, nothing
    reached the team, so the request fails with a 502 the visitor can act on
    and the ack is *not* sent — a "we got your message" copy for a message no
    one at BUZZ ever saw is worse than an honest error. If the notice landed
    and only the sender's copy failed, that is a normal, acceptable outcome
    (the team can still reply), so it must not fail the request.
    """

    if payload.website.strip():
        logger.warning("contact_form_honeypot_rejected")
        return api_response(data=ContactAccepted())

    contact_name = " ".join(part for part in (payload.first_name, payload.last_name) if part)
    # The key must hash EXACTLY the content that goes into the email body, and
    # the body must therefore carry no per-attempt value. Resend treats "same
    # key, different payload" as a failure (409 invalid_idempotent_request), so
    # a key built from content while the body also stamped a fresh timestamp
    # made every retry of the same message return 502 forever. The body no
    # longer includes a timestamp (the received time is on the email itself), so
    # an identical retry is a genuine replay: 2xx, no second send.
    #
    # The sender address is NOT a key part: a part containing "@" is rejected as
    # unsafe, which previously yielded ``None`` and disabled dedup entirely. The
    # hash keeps the address out of a provider-visible header.
    submission_hash = hashlib.sha256(
        "\n".join((payload.email, payload.first_name, payload.last_name, payload.message)).encode()
    ).hexdigest()
    notice_key = email.build_idempotency_key(email.KIND_CONTACT, submission_hash)

    notice_sent = await email.send_contact_notice(
        contact_name=contact_name,
        sender_email=payload.email,
        message=payload.message,
        idempotency_key=notice_key,
    )
    if not notice_sent:
        # No ack: the team never saw this, so claiming we did would be a lie the
        # visitor acts on. They still have their text on screen and can retry.
        logger.error("contact_notice_failed")
        raise BuzzAPIException(
            errors.EMAIL_SEND_FAILED,
            "We couldn't send that. Please try again.",
            status_code=502,
        )

    # Per-IP limits alone let one address receive up to 20 acknowledgements an
    # hour, since the idempotency key covers message content and changing a
    # single character makes a new send. Cap per recipient too, so the ack
    # cannot be used to flood a stranger's mailbox from the shared sender. Key
    # on the mailbox identity, not the literal address: ``victim+1@gmail.com``
    # and ``victim+2@gmail.com`` are separate strings that land in one inbox.
    #
    # Charged here rather than at the top of the handler: an attempt whose notice
    # never sent delivers nothing, so counting it would let three transient
    # provider failures lock a real sender out of their own allowance.
    enforce_account_limit(
        "contact_recipient", mailbox_identity(payload.email), limit=3, window=3600
    )

    ack_sent = await email.send_contact_ack(
        to_email=payload.email,
        contact_name=payload.first_name,
        idempotency_key=email.build_idempotency_key(email.KIND_CONTACT_ACK, submission_hash),
    )
    if not ack_sent:
        # Best-effort by design (see the docstring): the notice stands.
        logger.warning("contact_ack_failed")

    return api_response(data=ContactAccepted())
