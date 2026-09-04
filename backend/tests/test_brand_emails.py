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
    assert brand_emails.OPS_CC_EMAIL == raw["opsCcEmail"]
    assert brand_emails.EMAIL_FROM.strip()
    assert brand_emails.CONTACT_EMAIL.strip()
    assert brand_emails.OPS_CC_EMAIL.strip()


@pytest.mark.asyncio
async def test_dispatch_from_uses_json_not_env(monkeypatch) -> None:
    """Leftover EMAIL_FROM env must not change Resend ``from``."""
    monkeypatch.setenv("EMAIL_FROM", "Env Override <env@example.com>")
    monkeypatch.setattr(email.settings, "RESEND_API_KEY", "re_test_key")
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
