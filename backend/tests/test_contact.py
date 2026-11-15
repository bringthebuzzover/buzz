"""Public contact form: validation, honeypot, both sends, and the reply-to.

The mail provider is patched out — these assert *what we ask it to send*, which
is the part that matters here (the team must be able to just hit Reply, and the
sender must get a copy).
"""

from __future__ import annotations

import asyncio

import pytest
from httpx import AsyncClient
from pydantic import ValidationError

from app.config import settings
from app.schemas.contact import ContactRequest
from app.security import rate_limit
from app.services import email

_VALID = {"firstName": "A", "email": "a@b.co", "message": "hi"}


@pytest.fixture
def sent(monkeypatch) -> list[dict]:
    """Capture dispatched sends instead of reaching Resend."""
    captured: list[dict] = []

    async def _fake_dispatch(to_email, subject, body, **kwargs):
        captured.append({"to": to_email, "subject": subject, "body": body, **kwargs})
        return True

    monkeypatch.setattr(email, "_dispatch", _fake_dispatch)
    monkeypatch.setattr(email.settings, "ENVIRONMENT", "production")
    return captured


async def test_contact_sends_ops_notice_with_reply_to(app_client: AsyncClient, sent) -> None:
    resp = await app_client.post(
        "/api/contact",
        json={
            "firstName": "Jordan",
            "lastName": "Ellis",
            "email": "Jordan@Example.EDU",
            "message": "We'd love to run a drop in October.",
        },
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["accepted"] is True

    # Two sends: the team, then a copy for the sender.
    assert len(sent) == 2
    notice, ack = sent

    assert notice["to"] == email.CONTACT_EMAIL
    assert "Jordan Ellis" in notice["subject"]
    # The whole point: Reply lands in the sender's inbox, not a no-reply void.
    assert notice["reply_to"] == "jordan@example.edu"
    assert "We'd love to run a drop in October." in notice["body"]

    assert ack["to"] == "jordan@example.edu"
    # A fixed template only. Echoing the text would make this public endpoint a
    # relay that mails attacker-written content to an unverified address.
    assert "We'd love to run a drop in October." not in ack["body"]
    assert "received your message" in ack["body"].lower()


async def test_contact_honeypot_returns_success_and_sends_nothing(
    app_client: AsyncClient, sent
) -> None:
    resp = await app_client.post(
        "/api/contact",
        json={
            "firstName": "Bot",
            "email": "bot@example.com",
            "message": "buy my thing",
            "website": "http://spam.example",
        },
    )

    # Same success shape as a real submission — silence, not a hint.
    assert resp.status_code == 200
    assert sent == []


async def test_contact_honeypot_never_dispatches(app_client: AsyncClient, monkeypatch) -> None:
    """Regression: the route must return before any send is attempted.

    ``sent`` would hide this — it patches ``_dispatch`` and records calls, so an
    accidental send would still be visible, but a *failure* to send would not be
    distinguishable from a suppressed one. Track the call itself.
    """

    async def _fail(*_args, **_kwargs):
        raise AssertionError("_dispatch must not be called for a honeypot hit")

    monkeypatch.setattr(email, "_dispatch", _fail)
    monkeypatch.setattr(email.settings, "ENVIRONMENT", "production")

    resp = await app_client.post(
        "/api/contact",
        json={**_VALID, "website": "http://spam.example"},
    )
    assert resp.status_code == 200


@pytest.mark.parametrize(
    "payload",
    [
        {"firstName": "", "email": "a@b.co", "message": "hi"},
        {"firstName": "A", "email": "not-an-email", "message": "hi"},
        {"firstName": "A", "email": "a@b", "message": "hi"},
        {"firstName": "A", "email": "a@b.co", "message": "   "},
    ],
)
async def test_contact_rejects_invalid_input(app_client: AsyncClient, sent, payload: dict) -> None:
    resp = await app_client.post("/api/contact", json=payload)
    assert resp.status_code == 422
    assert sent == []


@pytest.mark.parametrize(
    "address",
    [
        # CRLF / control characters: the header-injection surface.
        "a@b.co\r\nBcc: evil@x.com",
        "a@b.co\nBcc: evil@x.com",
        "a@b.co\x00",
        "a@b.co\x7f",
        # Comma and semicolon: silently add recipients.
        "a@b.co,other@x.com",
        "a@b.co;other@x.com",
        # Angle brackets and quoted strings re-interpret the mailbox.
        "<a@b.co>",
        "Name <a@b.co>",
        '"a@b.co"',
        # Whitespace anywhere splits the header token.
        "a b@c.co",
        "a@b .co",
        "a @b.co",
        "a@ b.co",
        # Structure.
        "a@b@c.co",
        "@b.co",
        "a@.co",
        "a@b..co",
        "a@-b.co",
        "a@b.c",
        ".a@b.co",
        "a.@b.co",
        "a..b@c.co",
        "a@b.co.",
    ],
)
def test_contact_email_rejects_header_unsafe_shapes(address: str) -> None:
    with pytest.raises(ValidationError):
        ContactRequest(first_name="A", email=address, message="hi")


@pytest.mark.parametrize(
    "address",
    [
        # Surrounding whitespace (including a bare CR or LF) is trimmed away
        # before the check, so nothing control-ish survives into the header.
        " a@b.co",
        "a@b.co ",
        "a@b.co\r",
        "a@b.co\n",
        "\ta@b.co\t",
    ],
)
def test_contact_email_trims_surrounding_whitespace_to_a_safe_value(address: str) -> None:
    parsed = ContactRequest(first_name="A", email=address, message="hi")
    assert parsed.email == "a@b.co"


@pytest.mark.parametrize(
    "address",
    [
        "a@b.co",
        "jordan.ellis@example.edu",
        "first+tag@sub.example.co.uk",
        "  Jordan@Example.EDU  ",
        "o'brien@example.ie",
        "a_b-c@my-school.edu",
    ],
)
def test_contact_email_accepts_ordinary_addresses(address: str) -> None:
    parsed = ContactRequest(first_name="A", email=address, message="hi")
    assert parsed.email == address.strip().lower()


def test_contact_email_rejects_over_length() -> None:
    local = "a" * 60
    domain = ".".join(["b" * 60] * 5) + ".co"
    assert len(f"{local}@{domain}") > 320
    with pytest.raises(ValidationError):
        ContactRequest(first_name="A", email=f"{local}@{domain}", message="hi")


async def test_contact_names_cannot_carry_a_control_char_into_the_subject(
    app_client: AsyncClient, sent
) -> None:
    """The name is interpolated into the notice **subject**, a header value."""

    resp = await app_client.post(
        "/api/contact",
        json={
            "firstName": "Eve\r\nBcc: evil@x.com",
            "lastName": "Smith\r",
            "email": "eve@example.edu",
            "message": "hello",
        },
    )
    assert resp.status_code == 200, resp.text

    notice = sent[0]
    assert "\r" not in notice["subject"]
    assert "\n" not in notice["subject"]
    # The injected header never appears as its own line in the body either.
    assert "\r" not in notice["body"]


async def test_contact_message_newlines_do_not_reach_a_header(
    app_client: AsyncClient, sent
) -> None:
    """The message is body-only; this pins that it stays that way."""

    resp = await app_client.post(
        "/api/contact",
        json={**_VALID, "message": "line one\r\nline two\nline three"},
    )
    assert resp.status_code == 200, resp.text

    notice, ack = sent
    for msg in (notice, ack):
        assert "\r" not in msg["subject"]
        assert "\n" not in msg["subject"]
        assert "\r" not in msg["to"]
        assert "\r" not in str(msg.get("reply_to", ""))
    # The text survives intact in the ops notice — it is content, not a header —
    # and never appears in the ack, which carries no submitter text at all.
    assert "line one\r\nline two" in notice["body"]
    assert "line one" not in ack["body"]


async def test_contact_notice_failure_returns_502_and_skips_the_ack(
    app_client: AsyncClient, sent, monkeypatch
) -> None:
    """If the team never saw it, the sender must not be told we did."""

    calls: list[str] = []

    async def _notice_fails(to_email, subject, body, **kwargs):
        calls.append(to_email)
        return False

    monkeypatch.setattr(email, "_dispatch", _notice_fails)

    resp = await app_client.post("/api/contact", json=_VALID)

    assert resp.status_code == 502
    body = resp.json()
    assert body["error"]["code"] == "EMAIL_SEND_FAILED"
    assert "try again" in body["error"]["message"].lower()
    # Exactly one attempt: the ops notice. No ack for a message nobody got.
    assert calls == [email.CONTACT_EMAIL]


async def test_contact_ack_failure_does_not_fail_the_request(
    app_client: AsyncClient, sent, monkeypatch
) -> None:
    """The sender copy is best-effort; the ops notice is what must land."""
    calls = {"n": 0}

    async def _flaky(to_email, subject, body, **kwargs):
        calls["n"] += 1
        if calls["n"] == 2:
            return False
        sent.append({"to": to_email, "subject": subject, "body": body, **kwargs})
        return True

    monkeypatch.setattr(email, "_dispatch", _flaky)

    resp = await app_client.post("/api/contact", json=_VALID)
    assert resp.status_code == 200
    assert len(sent) == 1


# --- Rate limiting -----------------------------------------------------------


async def test_contact_minute_bucket_blocks_a_burst(
    app_client: AsyncClient, sent, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    rate_limit.reset()

    # Vary the address so the per-recipient cap does not answer first; this
    # test is about the per-IP minute bucket.
    statuses = [
        (
            await app_client.post("/api/contact", json={**_VALID, "email": f"burst{n}@b.co"})
        ).status_code
        for n in range(6)
    ]

    assert statuses[:5] == [200] * 5
    assert statuses[5] == 429


async def test_contact_caps_acknowledgements_per_recipient(
    app_client: AsyncClient, sent, monkeypatch
) -> None:
    """One address must not be floodable by varying the message text.

    The idempotency key covers message content, so editing one character makes
    a new send and the per-IP budgets alone would allow 20 an hour to the same
    inbox.
    """
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    rate_limit.reset()

    statuses = [
        (
            await app_client.post("/api/contact", json={**_VALID, "message": f"Message number {n}"})
        ).status_code
        for n in range(4)
    ]

    assert statuses[:3] == [200] * 3
    assert statuses[3] == 429


async def test_contact_plus_aliases_share_one_recipient_bucket(
    app_client: AsyncClient, sent, monkeypatch
) -> None:
    """A plus-tag must not reset the per-recipient budget.

    ``victim+1@gmail.com`` and ``victim+2@gmail.com`` are different strings but
    one inbox, so limiting the literal address would let a sender rotate the tag
    and keep delivering acknowledgements into the same mailbox.
    """
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    rate_limit.reset()

    statuses = [
        (
            await app_client.post("/api/contact", json={**_VALID, "email": f"victim+{n}@gmail.com"})
        ).status_code
        for n in range(4)
    ]

    assert statuses[:3] == [200] * 3
    assert statuses[3] == 429


async def test_contact_gmail_dot_variants_share_one_recipient_bucket(
    app_client: AsyncClient, sent, monkeypatch
) -> None:
    """Gmail ignores dots, so campus.team and campusteam are one inbox."""
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    rate_limit.reset()

    addresses = [
        "campusteam@gmail.com",
        "campus.team@gmail.com",
        "c.a.m.p.u.s.t.e.a.m@gmail.com",
        "campusteam+x@gmail.com",
    ]
    statuses = [
        (await app_client.post("/api/contact", json={**_VALID, "email": a})).status_code
        for a in addresses
    ]

    assert statuses[:3] == [200] * 3
    assert statuses[3] == 429


async def test_reservation_holds_under_concurrent_submissions(
    app_client: AsyncClient, sent, monkeypatch
) -> None:
    """Concurrent requests must not all see an unused budget.

    The counter is reserved before the first await, so a burst cannot read zero
    usage four times and deliver four acknowledgements to one mailbox.
    """
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    rate_limit.reset()

    responses = await asyncio.gather(
        *[
            app_client.post("/api/contact", json={**_VALID, "message": f"Concurrent {n}"})
            for n in range(5)
        ]
    )

    statuses = sorted(r.status_code for r in responses)
    assert statuses.count(200) == 3, statuses
    assert statuses.count(429) == 2, statuses


async def test_identical_retry_does_not_consume_the_allowance(
    app_client: AsyncClient, sent, monkeypatch
) -> None:
    """A replay is answered, not re-charged.

    The provider dedupes an identical submission by idempotency key. Charging
    each retry would spend the sender's whole allowance for a message that was
    sent once, and then reject a genuinely new message.
    """
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    rate_limit.reset()

    for _ in range(4):
        resp = await app_client.post("/api/contact", json=_VALID)
        assert resp.status_code == 200

    # The budget is untouched, so a different message still goes through.
    fresh = await app_client.post(
        "/api/contact", json={**_VALID, "message": "A genuinely new message"}
    )
    assert fresh.status_code == 200


async def test_refused_recipient_never_gets_the_notice(
    app_client: AsyncClient, sent, monkeypatch
) -> None:
    """A 429 must mean nothing was delivered.

    The team notice is the expensive, irreversible part: refusing after it sent
    would tell the visitor "too many requests" about a message BUZZ already
    received.
    """
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    rate_limit.reset()

    recipient = {"email": "repeat@example.edu"}
    for n in range(3):
        ok = await app_client.post(
            "/api/contact", json={**_VALID, **recipient, "message": f"Hello {n}"}
        )
        assert ok.status_code == 200

    delivered = len(sent)
    refused = await app_client.post(
        "/api/contact", json={**_VALID, **recipient, "message": "One too many"}
    )

    assert refused.status_code == 429
    assert len(sent) == delivered, "a refused request sent mail anyway"


async def test_failed_notice_does_not_consume_the_recipient_budget(
    app_client: AsyncClient, monkeypatch, sent
) -> None:
    """Only a delivered acknowledgement counts against the recipient cap."""
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    rate_limit.reset()

    async def _fail(to_email, subject, body, **kwargs):
        return False

    monkeypatch.setattr(email, "_dispatch", _fail)

    # Vary the message: an identical retry replays the idempotency key and is
    # answered from cache without reaching the provider at all.
    for n in range(4):
        resp = await app_client.post(
            "/api/contact", json={**_VALID, "message": f"Notice failure {n}"}
        )
        assert resp.status_code == 502

    keys = [k for k in rate_limit._buckets if k.startswith("contact_recipient:")]
    assert keys == [], keys


async def test_contact_counts_against_distinct_buckets(
    app_client: AsyncClient, sent, monkeypatch
) -> None:
    """Every limit must be attached and keyed separately, or one never binds."""
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    rate_limit.reset()

    assert (await app_client.post("/api/contact", json=_VALID)).status_code == 200

    keys = sorted(rate_limit._buckets)
    assert len(keys) == 3, keys
    minute_key = next(k for k in keys if k.startswith("contact_minute:ip:"))
    hour_key = next(k for k in keys if k.startswith("contact_hour:ip:"))
    recipient_key = next(k for k in keys if k.startswith("contact_recipient:acct:"))

    # Minute budget is untouched, but the hourly one is one short of its cap.
    start, _ = rate_limit._buckets[hour_key]
    rate_limit._buckets[hour_key] = (start, 20)
    assert (await app_client.post("/api/contact", json=_VALID)).status_code == 429
    # The 429 came from the hourly bucket, not the minute one.
    assert rate_limit._buckets[minute_key][1] == 2
    # The recipient bucket is keyed on the address, not the IP.
    assert recipient_key.endswith(_VALID["email"])


@pytest.mark.parametrize("key", ["Website", "WEBSITE", "webSite"])
async def test_contact_rejects_unknown_key_casing_instead_of_bypassing_the_honeypot(
    app_client: AsyncClient, sent, key: str
) -> None:
    """A casing variant of the honeypot must not slip past the guard.

    Pydantic ignores unknown keys by default, so before ``extra="forbid"`` a
    ``Website`` key left the honeypot at its empty default, passed the check,
    and sent both emails. Rejecting extras closes that and sends nothing.
    """
    resp = await app_client.post(
        "/api/contact",
        json={
            "firstName": "Bot",
            "email": "bot@example.com",
            "message": "buy my thing",
            key: "http://spam.example",
        },
    )

    assert resp.status_code == 422
    assert sent == []


async def test_contact_idempotency_key_is_actually_built(app_client: AsyncClient, sent) -> None:
    """The key must survive ``build_idempotency_key``.

    Passing the sender address produced ``None`` every time (a key part with
    ``@`` is rejected as unsafe), which silently disabled deduplication.
    """
    resp = await app_client.post("/api/contact", json=_VALID)
    assert resp.status_code == 200

    notice, ack = sent
    assert notice["idempotency_key"], "notice sent without a usable idempotency key"
    assert ack["idempotency_key"], "ack sent without a usable idempotency key"
    # The sender's address must not travel in a provider-visible header.
    assert "@" not in notice["idempotency_key"]
    assert "@" not in ack["idempotency_key"]


async def test_contact_same_submission_reuses_one_idempotency_key(
    app_client: AsyncClient, sent
) -> None:
    """An identical double-submit collapses onto the same key."""
    await app_client.post("/api/contact", json=_VALID)
    await app_client.post("/api/contact", json=_VALID)

    keys = [m["idempotency_key"] for m in sent]
    assert keys[0] == keys[2], keys
    assert keys[1] == keys[3], keys


async def test_contact_ack_never_echoes_submitter_text(app_client: AsyncClient, sent) -> None:
    """The ack is a fixed template.

    The endpoint is public and the address is unverified, so echoing the message
    would let anyone relay arbitrary text to anyone from the hello@ address that
    also carries verification mail. Nothing the submitter typed may appear.
    """
    marker = "UNIQUE-MARKER-do-not-echo-9f3a"
    name_marker = "JordanPhish9f3a"
    resp = await app_client.post(
        "/api/contact",
        json={
            "firstName": name_marker,
            "email": "jordan@example.edu",
            "message": marker,
        },
    )
    assert resp.status_code == 200

    notice, ack = sent
    # The team must still receive the actual message.
    assert marker in notice["body"]
    # The sender gets assurance and nothing else.
    assert marker not in ack["body"]
    assert marker not in ack["subject"]
    # The name is submitter-controlled too (100 chars of arbitrary text), and it
    # is interpolated into mail sent to an address nobody has verified.
    assert name_marker not in ack["body"]
    assert name_marker not in ack["subject"]
    assert "received your message" in ack["body"].lower()
