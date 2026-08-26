"""Verification email locked copy + html/reply_to (org.edu-verify-outlook-junk)."""

from __future__ import annotations

import httpx
import pytest

from app.brand_emails import CONTACT_EMAIL, EMAIL_FROM
from app.config import settings
from app.services import email


@pytest.fixture
def _resend_key(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(settings, "ENVIRONMENT", "staging")


def _stub_transport(monkeypatch, handler) -> None:
    monkeypatch.setattr(
        email,
        "_email_client",
        lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )


async def test_signup_verification_bodies_and_headers(monkeypatch, _resend_key) -> None:
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "e1"})

    _stub_transport(monkeypatch, handler)
    assert (
        await email.send_verification_email(
            "a@cornell.edu", "tok123", org_name="Campus Greeks", kind="signup"
        )
        is True
    )
    body = seen["body"]
    assert body["from"] == EMAIL_FROM
    assert "hello@" in EMAIL_FROM
    assert body["reply_to"] == CONTACT_EMAIL
    assert body["subject"] == "Confirm your Buzz account"
    assert "You just created a Buzz account for Campus Greeks" in body["text"]
    assert "html" in body
    assert "Verify email" in body["html"]
    assert "tok123" in body["html"]


async def test_rotate_verification_copy(monkeypatch, _resend_key) -> None:
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "e2"})

    _stub_transport(monkeypatch, handler)
    await email.send_verification_email(
        "b@cornell.edu", "tok456", org_name="Campus Greeks", kind="rotate"
    )
    body = seen["body"]
    assert body["subject"] == "Confirm the new school email for Campus Greeks"
    assert "Someone requested a new school email" in body["text"]
    assert "You just created" not in body["text"]
