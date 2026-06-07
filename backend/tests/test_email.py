"""Email transport (Resend) — production send path.

Exercises ``_dispatch`` directly against a stubbed httpx transport (the per-flow
``send_*`` helpers short-circuit to the console in development).
"""

from __future__ import annotations

import httpx
import pytest

from app.config import settings
from app.services import email


@pytest.fixture
def _resend_key(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(settings, "EMAIL_FROM", "Buzz <noreply@buzz.test>")


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
    await email._dispatch("to@campus.edu", "Subject", "Body text")

    assert seen["url"] == email._RESEND_ENDPOINT
    assert seen["auth"] == "Bearer re_test_key"
    assert seen["body"] == {
        "from": "Buzz <noreply@buzz.test>",
        "to": ["to@campus.edu"],
        "subject": "Subject",
        "text": "Body text",
    }


async def test_dispatch_without_key_does_not_send(monkeypatch) -> None:
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    called = False

    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
        nonlocal called
        called = True
        return httpx.Response(200, json={})

    _stub_transport(monkeypatch, handler)
    await email._dispatch("to@campus.edu", "S", "B")
    assert called is False


async def test_dispatch_swallows_provider_failure(monkeypatch, _resend_key) -> None:
    """A provider 4xx/5xx must not raise — email is best-effort."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"message": "boom"})

    _stub_transport(monkeypatch, handler)
    # Should not raise.
    await email._dispatch("to@campus.edu", "S", "B")
