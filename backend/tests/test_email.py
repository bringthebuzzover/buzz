"""Email transport (Resend) — production send path.

Exercises ``_dispatch`` directly against a stubbed httpx transport (the per-flow
``send_*`` helpers short-circuit to the console in development).
"""

from __future__ import annotations

import httpx
import pytest

from app.brand_emails import CONTACT_EMAIL, EMAIL_FROM
from app.config import settings
from app.services import email


@pytest.fixture
def _resend_key(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    # Defaults: fail-closed off, no allowlist, no subject prefix.
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "EMAIL_ALLOWLIST", "")
    monkeypatch.setattr(settings, "EMAIL_FAIL_CLOSED", False)
    monkeypatch.setattr(settings, "EMAIL_SUBJECT_PREFIX", "")


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
        "reply_to": CONTACT_EMAIL,
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
            contact_name="Emery",
        )
        is True
    )
    expected_cc = [addr for addr in (CONTACT_EMAIL, OPS_CC_EMAIL) if addr.strip()]
    assert seen["body"]["cc"] == expected_cc
    assert CONTACT_EMAIL in seen["body"]["cc"]


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
        contact_name="Emery Fakename",
    )
    assert "Kappa Alpha Theta" in subject
    assert "Kappa Alpha Theta" in text
    assert "UPDATE" in subject
    assert "UPDATE" in text
    assert "Emery" in text
    assert "prefill=preview" in text
    assert "prefill=preview" in html
    assert "/login" in text
    assert CONTACT_EMAIL in text
    assert CONTACT_EMAIL in html
    assert f"mailto:{CONTACT_EMAIL}" in html
    assert "Finish your chapter's profile" in html
    assert "color-scheme" in html
    assert "light only" in html
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
        email.applied_on_from_source_row_key("8/30/2026 16:30:08|ep105@example.edu") == "August 30"
    )
    assert email.applied_on_from_source_row_key("8/18/2026 1:19:20|ae101@example.edu") == (
        "August 18"
    )
    assert email.applied_on_from_source_row_key("not-a-date|x@y.edu") is None
    assert email.applied_on_from_source_row_key(None) is None


async def test_org_approved_email_links_tester_invite_tab(monkeypatch, _resend_key) -> None:
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "email_connect"})

    _stub_transport(monkeypatch, handler)
    assert (
        await email.send_org_approved_email(
            "org@campus.edu",
            org_name="Campus Greeks",
            connect_token="tok-connect",
        )
        is True
    )
    html = seen["body"]["html"]
    text = seen["body"]["text"]
    href = 'href="https://www.instagram.com/accounts/manage_access/"'
    assert href in html
    assert "Tester Invites tab" in html
    assert "invitation from BUZZ" in html
    assert "instagram.com/accounts/manage_access" in html
    assert "https://www.instagram.com/accounts/manage_access/" in text
    assert "Tester Invites tab" in text
    assert "invitation from BUZZ" in text
    assert "(Tester Invites)" not in text
    assert "(Tester Invites)" not in html
    assert 'class="buzz-mail-btn"' not in html
    assert "1. Open" in html and "2. " in html
    assert ">Connect Instagram</a>" in html
    assert "Or paste this link:" in html
    connect_href = f'href="{settings.FRONTEND_URL}/onboarding/connect-instagram?token=tok-connect"'
    assert html.count(connect_href) >= 2


async def test_org_ig_switch_email_tester_invite_copy(monkeypatch, _resend_key) -> None:
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "email_switch"})

    _stub_transport(monkeypatch, handler)
    assert (
        await email.send_org_ig_switch_connect_email(
            "org@campus.edu",
            org_name="Campus Greeks",
            connect_token="tok-switch",
            requested_handle="newcampusig",
        )
        is True
    )
    html = seen["body"]["html"]
    text = seen["body"]["text"]
    assert 'href="https://www.instagram.com/accounts/manage_access/"' in html
    assert "Tester Invites tab" in html and "Tester Invites tab" in text
    assert "invitation from BUZZ for @newcampusig" in html
    assert "invitation from BUZZ for @newcampusig" in text
    assert 'class="buzz-mail-btn"' not in html
    assert "1. Open" in html and "2. " in html
    assert ">Connect Instagram</a>" in html
    assert "Or paste this link:" in html


def _historical_payload(*, cc: list[str] | None = None) -> dict:
    """Resend JSON from before the allowlist flags existed."""

    body: dict = {
        "from": EMAIL_FROM,
        "to": ["to@campus.edu"],
        "subject": "Subject",
        "text": "Body text",
        "reply_to": CONTACT_EMAIL,
    }
    if cc is not None:
        body["cc"] = cc
    return body


@pytest.mark.parametrize("environment", ["staging", "production"])
async def test_unset_email_flags_match_historical_dispatch(
    monkeypatch, _resend_key, environment: str
) -> None:
    """Staging and production send the same payload when the new vars are unset."""

    monkeypatch.setattr(settings, "ENVIRONMENT", environment)
    monkeypatch.setattr(settings, "EMAIL_FAIL_CLOSED", False)
    monkeypatch.setattr(settings, "EMAIL_ALLOWLIST", "")
    monkeypatch.setattr(settings, "EMAIL_SUBJECT_PREFIX", "")
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "email_hist"})

    _stub_transport(monkeypatch, handler)
    cc = ["ops@acme.test", "other@example.com"]
    assert await email._dispatch("to@campus.edu", "Subject", "Body text", cc=cc) is True
    assert seen["body"] == _historical_payload(cc=cc)


@pytest.mark.parametrize("environment", ["staging", "production"])
async def test_allowlist_without_fail_closed_does_not_filter(
    monkeypatch, _resend_key, environment: str
) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", environment)
    monkeypatch.setattr(settings, "EMAIL_FAIL_CLOSED", False)
    monkeypatch.setattr(settings, "EMAIL_ALLOWLIST", "@campus.edu")
    monkeypatch.setattr(settings, "EMAIL_SUBJECT_PREFIX", "")
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "email_open"})

    _stub_transport(monkeypatch, handler)
    assert (
        await email._dispatch(
            "outsider@example.com",
            "Subject",
            "Body text",
            cc=["drop@other.test"],
        )
        is True
    )
    assert seen["body"]["to"] == ["outsider@example.com"]
    assert seen["body"]["cc"] == ["drop@other.test"]
    assert seen["body"]["subject"] == "Subject"


@pytest.mark.parametrize("environment", ["staging", "production"])
async def test_fail_closed_empty_allowlist_suppresses_all(
    monkeypatch, _resend_key, caplog, environment: str
) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", environment)
    monkeypatch.setattr(settings, "EMAIL_FAIL_CLOSED", True)
    monkeypatch.setattr(settings, "EMAIL_ALLOWLIST", "")
    monkeypatch.setattr(settings, "EMAIL_SUBJECT_PREFIX", "")
    called = False

    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
        nonlocal called
        called = True
        return httpx.Response(200, json={})

    _stub_transport(monkeypatch, handler)
    with caplog.at_level("WARNING"):
        assert await email._dispatch("org@campus.edu", "Hello", "Body") is False
    assert called is False
    assert "email suppressed (not allowlisted)" in caplog.text
    assert "[STAGING]" not in caplog.text
    assert "org@campus.edu" not in caplog.text
    assert email._email_addr_hash("org@campus.edu") in caplog.text


async def test_fail_closed_allowlisted_address_is_delivered(monkeypatch, _resend_key) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "EMAIL_FAIL_CLOSED", True)
    monkeypatch.setattr(settings, "EMAIL_ALLOWLIST", "ops@acme.test, @campus.edu")
    monkeypatch.setattr(settings, "EMAIL_SUBJECT_PREFIX", "[STAGING] ")
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "email_ok"})

    _stub_transport(monkeypatch, handler)
    assert await email._dispatch("org@campus.edu", "Hello", "Body") is True
    assert seen["body"]["to"] == ["org@campus.edu"]
    assert seen["body"]["subject"] == "[STAGING] Hello"


async def test_fail_closed_suppresses_non_allowlisted(monkeypatch, _resend_key, caplog) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", "staging")
    monkeypatch.setattr(settings, "EMAIL_FAIL_CLOSED", True)
    monkeypatch.setattr(settings, "EMAIL_ALLOWLIST", "@campus.edu")
    monkeypatch.setattr(settings, "EMAIL_SUBJECT_PREFIX", "")
    called = False

    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
        nonlocal called
        called = True
        return httpx.Response(200, json={})

    _stub_transport(monkeypatch, handler)
    with caplog.at_level("WARNING"):
        assert await email._dispatch("outsider@example.com", "Hello", "Body") is False
    assert called is False
    assert "email suppressed (not allowlisted)" in caplog.text
    assert "outsider@example.com" not in caplog.text
    assert email._email_addr_hash("outsider@example.com") in caplog.text


async def test_fail_closed_filters_cc(monkeypatch, _resend_key, caplog) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "EMAIL_FAIL_CLOSED", True)
    monkeypatch.setattr(settings, "EMAIL_ALLOWLIST", "org@campus.edu, kept@campus.edu")
    monkeypatch.setattr(settings, "EMAIL_SUBJECT_PREFIX", "")
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "email_cc"})

    _stub_transport(monkeypatch, handler)
    with caplog.at_level("WARNING"):
        assert (
            await email._dispatch(
                "org@campus.edu",
                "Hello",
                "Body",
                cc=["kept@campus.edu", "drop@other.test"],
            )
            is True
        )
    assert seen["body"]["cc"] == ["kept@campus.edu"]
    assert seen["body"]["subject"] == "Hello"
    assert "drop@other.test" not in caplog.text
    assert "email suppressed (not allowlisted)" in caplog.text
    assert email._email_addr_hash("drop@other.test") in caplog.text


async def test_subject_prefix_is_explicit_and_not_doubled(monkeypatch, _resend_key) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "EMAIL_FAIL_CLOSED", False)
    monkeypatch.setattr(settings, "EMAIL_SUBJECT_PREFIX", "[STAGING] ")
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "email_prefix"})

    _stub_transport(monkeypatch, handler)
    assert await email._dispatch("org@campus.edu", "[STAGING] Hello", "Body") is True
    assert seen["body"]["subject"] == "[STAGING] Hello"
