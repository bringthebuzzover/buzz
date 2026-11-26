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

import asyncio
import hashlib
import json
import logging

from fastapi import APIRouter, Depends

from app import errors
from app.exceptions import BuzzAPIException
from app.response import APIResponse, DataResponse, api_response
from app.schemas.contact import ContactAccepted, ContactRequest
from app.schemas.email_rules import mailbox_identity
from app.security.rate_limit import (
    mark_submission_accepted,
    rate_limited,
    release_account_send,
    reserve_account_send,
    start_submission,
    submission_already_accepted,
    submission_in_flight,
)
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

    contact_name = payload.name
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
    how_found = None
    parts = (payload.email, contact_name, payload.type, payload.message)
    # Preserve the key for older submissions with no answer. Encode the new
    # format structurally so newlines in the message cannot collide with fields.
    hash_input = "\n".join(parts)
    if payload.how_found is not None:
        how_found = payload.how_found.label
        if payload.how_found_other is not None:
            how_found = f"{how_found}: {payload.how_found_other}"
        hash_input = json.dumps((*parts, how_found))
    submission_hash = hashlib.sha256(hash_input.encode()).hexdigest()
    notice_key = email.build_idempotency_key(email.KIND_CONTACT, submission_hash)

    # Per-IP limits alone let one address receive up to 20 acknowledgements an
    # hour, since the idempotency key covers message content and changing a
    # single character makes a new send. Cap per recipient too, so the ack
    # cannot be used to flood a stranger's mailbox from the shared sender. Key
    # on the mailbox identity, not the literal address: plus-tags and Gmail dots
    # are aliases of one inbox.
    #
    # Reserved synchronously, before the first await, and given back if the send
    # does not happen. Checking and incrementing around an await would let
    # concurrent submissions all read zero usage and all deliver. Refusing after
    # the notice went out would tell the visitor "too many requests" about a
    # message the team already received.
    recipient_key = mailbox_identity(payload.email)
    # A byte-identical retry (lost response, double click) is answered from the
    # marker without reserving or dispatching again. An overlapping retry joins
    # the in-flight delivery and shares its reservation and outcome.
    if submission_already_accepted(submission_hash):
        # Already accepted and already delivered. Answering from the marker rather
        # than dispatching again is what keeps the cap meaningful: the provider's
        # idempotency keys expire, so a re-dispatch would eventually send a second
        # real email with no reservation behind it.
        return api_response(data=ContactAccepted())

    pending = submission_in_flight(submission_hash)
    if pending is not None:
        await asyncio.shield(pending)
        return api_response(data=ContactAccepted())

    if not reserve_account_send("contact_recipient", recipient_key, limit=3, window=3600):
        raise BuzzAPIException(
            errors.RATE_LIMITED,
            "Too many requests. Please slow down and try again shortly.",
            status_code=429,
        )

    async def deliver() -> None:
        notice_sent = False
        try:
            notice_sent = await email.send_contact_notice(
                contact_name=contact_name,
                contact_type=payload.type,
                sender_email=payload.email,
                message=payload.message,
                how_found=how_found,
                idempotency_key=notice_key,
            )
        finally:
            if not notice_sent:
                # Give the reservation back: nothing was delivered.
                release_account_send("contact_recipient", recipient_key)
        if not notice_sent:
            # No ack: the team never saw this, so claiming we did would be a lie the
            # visitor acts on. They still have their text on screen and can retry.
            logger.error("contact_notice_failed")
            raise BuzzAPIException(
                errors.EMAIL_SEND_FAILED,
                "We couldn't send that. Please try again.",
                status_code=502,
            )

        try:
            ack_sent = await email.send_contact_ack(
                to_email=payload.email,
                contact_name=contact_name,
                idempotency_key=email.build_idempotency_key(
                    email.KIND_CONTACT_ACK, submission_hash
                ),
            )
        finally:
            # Once the notice landed, even an interrupted ack must not let a
            # later retry reserve and send the notice again.
            mark_submission_accepted(submission_hash)
        if not ack_sent:
            # The notice landed, so the submission stands and keeps its reservation;
            # only the courtesy copy failed.
            logger.warning("contact_ack_failed")

    pending = start_submission(submission_hash, deliver())
    await asyncio.shield(pending)
    return api_response(data=ContactAccepted())
