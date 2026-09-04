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


async def test_update_prefill_send_ccs_contact_and_ops(monkeypatch, _resend_key) -> None:
    from app.brand_emails import CONTACT_EMAIL, OPS_CC_EMAIL

    monkeypatch.setattr(settings, "ENVIRONMENT", "staging")
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "email_update_cc"})

    _stub_transport(monkeypatch, handler)
    assert (
        await email.send_org_apply_prefill_update_email(
            "org@campus.edu",
            "preview",
            org_name="Kappa Alpha Theta",
            contact_name="Mia",
        )
        is True
    )
    assert seen["body"]["cc"] == [CONTACT_EMAIL, OPS_CC_EMAIL]
    assert CONTACT_EMAIL in seen["body"]["cc"]
    assert OPS_CC_EMAIL in seen["body"]["cc"]


def test_org_apply_prefill_email_copy() -> None:
    subject, text, html = email.build_org_apply_prefill_email(
        "preview",
        org_name="Campus Greeks",
    )
    assert subject == "Finish Campus Greeks's Buzz profile"
    assert "You told us you're interested in Buzz." in text
    assert "exclusive brand partnerships" in text
    assert "Finish your profile" in html
    assert "prefill=preview" in html


def test_org_apply_prefill_update_email_fields() -> None:
    from app.brand_emails import CONTACT_EMAIL

    subject, text, html = email.build_org_apply_prefill_update_email(
        "preview",
        org_name="Kappa Alpha Theta",
        contact_name="Mia Philippi",
    )
    assert "Kappa Alpha Theta" in subject
    assert "Kappa Alpha Theta" in text
    assert "UPDATE" in subject
    assert "UPDATE" in text
    assert "Mia" in text
    assert "prefill=preview" in text
    assert "prefill=preview" in html
    assert "/login" in text
    assert CONTACT_EMAIL in text
    assert CONTACT_EMAIL in html
    assert f"mailto:{CONTACT_EMAIL}" in html
    assert "Finish your chapter's profile" in html
    assert "The BUZZ Team" in text
    assert "The BUZZ Team" in html
    # Paste-this-link row is an <a>, not plain text only
    assert html.count(f'href="{settings.FRONTEND_URL.rstrip("/")}/org/apply?prefill=preview"') >= 2
    _, no_name_text, _ = email.build_org_apply_prefill_update_email(
        "preview",
        org_name="Campus Greeks",
    )
    assert "Campus Greeks" in no_name_text
    assert "Hi!" in no_name_text


def test_applied_on_from_source_row_key() -> None:
    assert (
        email.applied_on_from_source_row_key("8/30/2026 16:30:08|mp2282@cornell.edu") == "August 30"
    )
    assert email.applied_on_from_source_row_key("8/18/2026 1:19:20|mc3237@cornell.edu") == (
        "August 18"
    )
    assert email.applied_on_from_source_row_key("not-a-date|x@y.edu") is None
    assert email.applied_on_from_source_row_key(None) is None
