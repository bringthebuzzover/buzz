"""Public contact form: validation, honeypot, both sends, and the reply-to.

The mail provider is patched out — these assert *what we ask it to send*, which
is the part that matters here (the team must be able to just hit Reply, and the
sender must get a copy).
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.services import email


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
    # The ack carries their words back so they have a record of what they sent.
    assert "We'd love to run a drop in October." in ack["body"]


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

    resp = await app_client.post(
        "/api/contact",
        json={"firstName": "A", "email": "a@b.co", "message": "hi"},
    )
    assert resp.status_code == 200
    assert len(sent) == 1
