"""Committed brand_emails.json is the From/contact SOT (not env)."""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx
import pytest

from app import brand_emails
from app.services import email

_JSON_PATH = Path(__file__).resolve().parents[1] / "brand_emails.json"


def test_brand_emails_json_matches_loaded_constants() -> None:
    raw = json.loads(_JSON_PATH.read_text(encoding="utf-8"))
    assert brand_emails.EMAIL_FROM == raw["emailFrom"]
    assert brand_emails.CONTACT_EMAIL == raw["contactEmail"]
    assert brand_emails.OPS_CC_EMAIL == raw.get("opsCcEmail", "").strip()
    assert brand_emails.EMAIL_FROM.strip()
    assert brand_emails.CONTACT_EMAIL.strip()


@pytest.mark.asyncio
async def test_dispatch_from_uses_json_not_env(monkeypatch) -> None:
    """Leftover EMAIL_FROM env must not change Resend ``from``."""
    monkeypatch.setenv("EMAIL_FROM", "Env Override <env@example.com>")
    monkeypatch.setattr(email.settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(email.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(email.settings, "EMAIL_ALLOWLIST", "")
    monkeypatch.setattr(email.settings, "EMAIL_FAIL_CLOSED", False)
    monkeypatch.setattr(email.settings, "EMAIL_SUBJECT_PREFIX", "")
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "email_env_ignored"})

    monkeypatch.setattr(
        email,
        "_email_client",
        lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    assert await email._dispatch("to@campus.edu", "Subject", "Body") is True
    assert seen["body"]["from"] == brand_emails.EMAIL_FROM
    assert seen["body"]["from"] != os.environ["EMAIL_FROM"]
    assert "cc" not in seen["body"]


@pytest.mark.asyncio
async def test_brand_apply_sends_one_ops_notice(app_client, monkeypatch) -> None:
    monkeypatch.setattr(email.settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(email.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(email.settings, "BRAND_SELF_REGISTRATION_ENABLED", True)
    monkeypatch.setattr(email.settings, "EMAIL_ALLOWLIST", "")
    monkeypatch.setattr(email.settings, "EMAIL_FAIL_CLOSED", False)
    monkeypatch.setattr(email.settings, "EMAIL_SUBJECT_PREFIX", "")
    # Keep all recipients synthetic while testing the CONTACT_EMAIL wiring.
    monkeypatch.setattr(email, "CONTACT_EMAIL", "ops@example.com")
    monkeypatch.setattr(email, "OPS_CC_EMAIL", "ops-cc@example.com")
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"id": "email_brand_applied"})

    monkeypatch.setattr(
        email,
        "_email_client",
        lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    response = await app_client.post(
        "/api/brands/apply",
        json={
            "contactName": "  Test Applicant  ",
            "brandName": "Test Company",
            "companyEmail": "user1@example.com",
            "marketingBudget": "20k_50k",
            "intentMessage": "  Campus campaign.  ",
        },
    )
    assert response.status_code == 200, response.text
    assert len(seen) == 1
    body = json.loads(seen[0].content)
    brand_id = response.json()["data"]["brandId"]
    assert body["to"] == [email.CONTACT_EMAIL]
    assert body["cc"] == ["ops-cc@example.com"]
    assert body["reply_to"] == "user1@example.com"
    assert body["subject"] == "New brand application: Test Company (Test Applicant)"
    for text in (
        "Full name: Test Applicant",
        "Company name: Test Company",
        "Email: user1@example.com",
        "University marketing budget: $20k–$50k",
        "Short message: Campus campaign.",
        "Submitted:",
        f"{email.settings.FRONTEND_URL}/admin/brands/{brand_id}",
    ):
        assert text in body["text"]
    assert "Open application" in body["html"]
    assert seen[0].headers["Idempotency-Key"] == f"brand-applied/{brand_id}"
