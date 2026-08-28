"""Email transport (Resend) — production send path.

Exercises ``_dispatch`` directly against a stubbed httpx transport (the per-flow
``send_*`` helpers short-circuit to the console in development).
"""

from __future__ import annotations

import httpx
import pytest

from app.brand_emails import EMAIL_FROM
from app.config import settings
from app.services import email


@pytest.fixture
def _resend_key(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")


def _stub_transport(monkeypatch, handler) -> None:
    monkeypatch.setattr(
        email,
        "_email_client",
        lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )


async def test_dispatch_posts_to_resend(monkeypatch, _resend_key) -> None:
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        import json

        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "email_123"})

    _stub_transport(monkeypatch, handler)
    assert await email._dispatch("to@campus.edu", "Subject", "Body text") is True

    assert seen["url"] == email._RESEND_ENDPOINT
    assert seen["auth"] == "Bearer re_test_key"
    assert seen["body"] == {
        "from": EMAIL_FROM,
        "to": ["to@campus.edu"],
        "subject": "Subject",
        "text": "Body text",
        "reply_to": "mc3237@cornell.edu",
    }


async def test_dispatch_without_key_does_not_send(monkeypatch) -> None:
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    called = False

    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
        nonlocal called
        called = True
        return httpx.Response(200, json={})

    _stub_transport(monkeypatch, handler)
    assert await email._dispatch("to@campus.edu", "S", "B") is False
    assert called is False


async def test_dispatch_swallows_provider_failure(monkeypatch, _resend_key) -> None:
    """A provider 4xx/5xx must not raise — email is best-effort."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"message": "boom"})

    _stub_transport(monkeypatch, handler)
    assert await email._dispatch("to@campus.edu", "S", "B") is False


async def test_verification_dev_path_returns_true(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    assert await email.send_verification_email("a@test.edu", "tok") is True


async def test_drop_published_email_uses_hello_from_and_cta(monkeypatch, _resend_key) -> None:
    from app.brand_emails import CONTACT_EMAIL, EMAIL_FROM

    monkeypatch.setattr(settings, "ENVIRONMENT", "staging")
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "email_pub"})

    _stub_transport(monkeypatch, handler)
    drop_url = "https://app.example/brand/drops/abc"
    assert (
        await email.send_drop_published_email(
            "ops@acme.test",
            brand_name="Acme",
            drop_title="Spring Drop",
            drop_url=drop_url,
        )
        is True
    )
    assert seen["body"]["from"] == EMAIL_FROM
    assert "hello@" in EMAIL_FROM
    assert seen["body"]["reply_to"] == CONTACT_EMAIL
    assert seen["body"]["to"] == ["ops@acme.test"]
    assert drop_url in seen["body"]["text"]
    assert "View drop" in seen["body"]["html"]
    assert drop_url in seen["body"]["html"]
