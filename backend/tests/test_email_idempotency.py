"""Resend Idempotency-Key: opt-in per kind, never a raw token or email.

A wrong key silently drops a legitimate send, so these tests lock the header,
the per-request uniqueness of repeatable mail, and 409-is-not-success.
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.config import settings
from app.models.enums import BrandStatus, OrgUserStatus
from app.models.org_apply_prefill import OrgApplyPrefill
from app.models.user import User
from app.security.password import hash_password
from app.services import email, org_apply_prefill
from app.services.admin import resend_brand_invite
from app.services.onboarding import _mint_and_send_verification
from app.services.password_reset import request_password_reset
from tests.conftest import make_brand, make_drop, make_notify, make_org, make_user, persist

_NOTIFY_ID = "11111111-1111-4111-8111-111111111111"
_OTHER_NOTIFY_ID = "22222222-2222-4222-8222-222222222222"
_APP_A = "33333333-3333-4333-8333-333333333333"
_APP_B = "44444444-4444-4444-8444-444444444444"


@pytest.fixture
def _resend_key(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(settings, "ENVIRONMENT", "staging")


def _stub(monkeypatch, handler) -> None:
    monkeypatch.setattr(
        email,
        "_email_client",
        lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )


def _capture_header(monkeypatch):
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["header"] = request.headers.get("idempotency-key")
        seen["has_header"] = "idempotency-key" in request.headers
        return httpx.Response(200, json={"id": "email_ok"})

    _stub(monkeypatch, handler)
    return seen


def test_build_refuses_email_kind_only_and_none_part() -> None:
    assert email.build_idempotency_key(email.KIND_VERIFICATION, "person@school.edu") is None
    assert email.build_idempotency_key(email.KIND_REMINDER) is None
    assert email.build_idempotency_key(email.KIND_REMINDER, None) is None
    assert email.build_idempotency_key("Reminder", _NOTIFY_ID) is None


def test_build_hashes_raw_token_and_stays_within_256() -> None:
    raw = "super-secret-otp-token-value-not-a-uuid"
    key = email.build_idempotency_key(email.KIND_VERIFICATION, raw)
    assert key is not None
    assert raw not in key
    assert "@" not in key
    assert len(key) <= 256
    digest = hashlib.sha256(raw.encode()).hexdigest()
    assert key == f"{email.KIND_VERIFICATION}/{digest}"

    huge = email.build_idempotency_key(email.KIND_VERIFICATION, *([raw] * 6))
    assert huge is not None
    assert len(huge) <= 256
    assert raw not in huge
    assert huge.startswith(f"{email.KIND_VERIFICATION}/")


def test_reminder_key_stable_and_distinct_per_recipient() -> None:
    first = email.build_idempotency_key(email.KIND_REMINDER, _NOTIFY_ID)
    again = email.build_idempotency_key(email.KIND_REMINDER, _NOTIFY_ID)
    other = email.build_idempotency_key(email.KIND_REMINDER, _OTHER_NOTIFY_ID)
    assert first == again
    assert first != other
    assert first == f"{email.KIND_REMINDER}/{_NOTIFY_ID}"


def test_same_campaign_different_recipients_and_templates() -> None:
    denied_a = email.build_idempotency_key(email.KIND_APPLICATION_DENIED, _APP_A)
    denied_b = email.build_idempotency_key(email.KIND_APPLICATION_DENIED, _APP_B)
    late_org = email.build_idempotency_key(email.KIND_LATE_ADD_ORG, _APP_A)
    late_brand = email.build_idempotency_key(email.KIND_LATE_ADD_BRAND, _APP_A)
    assert denied_a != denied_b
    assert late_org != late_brand
    assert denied_a != late_org


def test_prefill_resend_generation_changes_the_key() -> None:
    row = OrgApplyPrefill()
    row.id = uuid.UUID(_APP_A)
    row.email_sent_at = None
    first = org_apply_prefill._prefill_idempotency_key(email.KIND_ORG_APPLY_PREFILL, row)
    row.email_sent_at = datetime(2026, 10, 26, 18, 4, 5, 6, tzinfo=timezone.utc)
    resent = org_apply_prefill._prefill_idempotency_key(email.KIND_ORG_APPLY_PREFILL, row)
    updated = org_apply_prefill._prefill_idempotency_key(email.KIND_ORG_APPLY_PREFILL_UPDATE, row)
    assert first == f"{email.KIND_ORG_APPLY_PREFILL}/{_APP_A}"
    assert resent != first
    assert resent is not None and "20261026T180405000006Z" in resent
    assert updated != resent
    assert updated is not None and updated.startswith(email.KIND_ORG_APPLY_PREFILL_UPDATE)


@pytest.mark.parametrize(
    ("sender", "kwargs"),
    [
        (
            email.send_verification_email,
            {"to_email": "a@school.edu", "token": "otp-secret"},
        ),
        (
            email.send_brand_invite_email,
            {"to_email": "a@brand.test", "setup_token": "invite-secret"},
        ),
        (email.send_org_approved_email, {"to_email": "a@school.edu"}),
        (
            email.send_org_ig_switch_connect_email,
            {"to_email": "a@school.edu", "connect_token": "connect-secret"},
        ),
        (email.send_org_ig_rename_approved_email, {"to_email": "a@school.edu"}),
        (email.send_org_ig_change_denied_email, {"to_email": "a@school.edu"}),
        (
            email.send_org_apply_prefill_email,
            {"to_email": "a@school.edu", "raw_token": "prefill-secret"},
        ),
        (
            email.send_org_apply_prefill_update_email,
            {"to_email": "a@school.edu", "raw_token": "prefill-secret"},
        ),
        (email.send_org_denied_email, {"to_email": "a@school.edu"}),
        (email.send_org_erased_email, {"to_email": "a@school.edu"}),
        (email.send_brand_erased_email, {"to_email": "a@brand.test"}),
        (email.send_brand_denied_email, {"to_email": "a@brand.test"}),
        (email.send_org_undenied_email, {"to_email": "a@school.edu"}),
        (email.send_brand_undenied_email, {"to_email": "a@brand.test"}),
        (email.send_application_denied_email, {"to_email": "a@school.edu"}),
        (email.send_drop_opening_reminder_email, {"to_email": "a@school.edu"}),
        (
            email.send_drop_published_email,
            {"to_email": "a@brand.test", "drop_url": "https://example.test/d"},
        ),
        (email.send_drop_hidden_email, {"to_email": "a@brand.test"}),
        (
            email.send_password_reset_email,
            {"to_email": "a@brand.test", "token": "reset-secret", "portal": "brand"},
        ),
        (
            email.send_admin_compose_email,
            {"to_email": "a@school.edu", "subject": "Hi", "body": "Body"},
        ),
        (
            email.send_late_add_org_email,
            {"to_email": "a@school.edu", "campaign_url": "https://example.test/c"},
        ),
        (
            email.send_late_add_brand_email,
            {"to_email": "a@brand.test", "drop_url": "https://example.test/d"},
        ),
    ],
)
async def test_header_absent_without_key(monkeypatch, _resend_key, sender, kwargs) -> None:
    seen = _capture_header(monkeypatch)
    assert await sender(**kwargs) is True
    assert seen["has_header"] is False


@pytest.mark.parametrize(
    "sender_kwargs",
    [
        lambda key: email.send_verification_email(
            "a@school.edu", "otp-secret", idempotency_key=key
        ),
        lambda key: email.send_brand_invite_email(
            "a@brand.test", "invite-secret", idempotency_key=key
        ),
        lambda key: email.send_password_reset_email(
            "a@brand.test", "reset-secret", portal="brand", idempotency_key=key
        ),
        lambda key: email.send_drop_opening_reminder_email("a@school.edu", idempotency_key=key),
        lambda key: email.send_application_denied_email("a@school.edu", idempotency_key=key),
        lambda key: email.send_drop_published_email(
            "a@brand.test", drop_url="https://example.test/d", idempotency_key=key
        ),
    ],
)
async def test_header_present_when_key_passed(monkeypatch, _resend_key, sender_kwargs) -> None:
    seen = _capture_header(monkeypatch)
    key = email.build_idempotency_key(email.KIND_REMINDER, _NOTIFY_ID)
    assert key is not None
    assert await sender_kwargs(key) is True
    assert seen["header"] == key
    assert "otp-secret" not in (seen["header"] or "")
    assert "invite-secret" not in (seen["header"] or "")
    assert "reset-secret" not in (seen["header"] or "")
    assert "@" not in (seen["header"] or "")


async def test_replayed_200_is_success(monkeypatch, _resend_key) -> None:
    seen = _capture_header(monkeypatch)
    key = email.build_idempotency_key(email.KIND_REMINDER, _NOTIFY_ID)
    assert await email._dispatch("a@school.edu", "S", "B", idempotency_key=key) is True
    assert await email._dispatch("a@school.edu", "S", "B", idempotency_key=key) is True
    assert seen["header"] == key


async def test_unsafe_key_is_dropped_and_mail_still_sends(monkeypatch, _resend_key, caplog) -> None:
    seen = _capture_header(monkeypatch)
    caplog.set_level(logging.ERROR)
    ok = await email._dispatch(
        "a@school.edu",
        "S",
        "B",
        idempotency_key="person@school.edu",
    )
    assert ok is True
    assert seen["has_header"] is False
    assert "person@school.edu" not in caplog.text
    assert "Dropping idempotency key" in caplog.text


@pytest.mark.parametrize(
    "error_name",
    ["invalid_idempotent_request", "concurrent_idempotent_requests"],
)
async def test_409_is_not_success(monkeypatch, _resend_key, caplog, error_name) -> None:
    key = email.build_idempotency_key(email.KIND_REMINDER, _NOTIFY_ID)
    assert key is not None

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"name": error_name, "message": "conflict"})

    _stub(monkeypatch, handler)
    caplog.set_level(logging.ERROR)
    assert await email._dispatch("a@school.edu", "S", "B", idempotency_key=key) is False
    assert error_name in caplog.text
    assert "not sent-success" in caplog.text
    assert email.KIND_REMINDER in caplog.text
    assert key not in caplog.text
    assert caplog.text.count(hashlib.sha256(key.encode()).hexdigest()[:16]) >= 1


async def test_verification_rerequest_uses_a_new_key(db_session, monkeypatch) -> None:
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_EMAIL_VERIFICATION, instagram_user_id="ig_idem"),
    )
    user.edu_email = "idem@school.edu"
    captured: list[tuple[str, str | None]] = []

    async def _fake(to_email, token, *, org_name="", kind="signup", idempotency_key=None):
        captured.append((token, idempotency_key))
        return True

    monkeypatch.setattr("app.services.onboarding.send_verification_email", _fake)
    assert await _mint_and_send_verification(db_session, user, user.edu_email) is True
    assert await _mint_and_send_verification(db_session, user, user.edu_email) is True
    assert captured[0][0] != captured[1][0]
    assert captured[0][1] != captured[1][1]
    for raw, key in captured:
        assert key is not None
        assert raw not in key
        assert user.edu_email not in key
        assert key.startswith(f"{email.KIND_VERIFICATION}/")
        assert len(key) <= 256


async def test_password_reset_rerequest_uses_a_new_key(db_session, monkeypatch) -> None:
    brand = await make_brand(db_session, company_email="reset-idem@brand.test")
    brand.status = BrandStatus.APPROVED.value
    user = await db_session.get(User, brand.user_id)
    assert user is not None
    user.status = OrgUserStatus.ACTIVE.value
    user.password_hash = hash_password("old-password-1")
    await db_session.flush()
    captured: list[tuple[str, str | None]] = []

    async def _fake(to_email, token, *, portal, idempotency_key=None):
        captured.append((token, idempotency_key))
        return True

    monkeypatch.setattr("app.services.password_reset.send_password_reset_email", _fake)
    await request_password_reset(db_session, portal="brand", email=brand.company_email)
    await request_password_reset(db_session, portal="brand", email=brand.company_email)
    assert captured[0][0] != captured[1][0]
    assert captured[0][1] != captured[1][1]
    for raw, key in captured:
        assert key is not None
        assert raw not in key
        assert "reset-idem@brand.test" not in key
        assert key.startswith(f"{email.KIND_PASSWORD_RESET}/")


async def test_brand_invite_resend_uses_a_new_key(db_session, monkeypatch) -> None:
    brand = await make_brand(db_session, company_email="invite-idem@brand.test")
    captured: list[tuple[str, str | None]] = []

    async def _fake(to_email, token, *, brand_name="", idempotency_key=None):
        captured.append((token, idempotency_key))
        return True

    monkeypatch.setattr("app.services.admin.send_brand_invite_email", _fake)
    await resend_brand_invite(db_session, brand.id)
    await resend_brand_invite(db_session, brand.id)
    assert captured[0][0] != captured[1][0]
    assert captured[0][1] != captured[1][1]
    for raw, key in captured:
        assert key is not None
        assert raw not in key
        assert brand.company_email not in key
        assert key.startswith(f"{email.KIND_BRAND_INVITE}/")


async def test_reminder_retry_reuses_row_key_and_recipients_differ(db_session, monkeypatch) -> None:
    from app.jobs.notify_reminders import send_due_reminders

    now = datetime.now(timezone.utc)
    user_a = await persist(
        db_session, make_user(instagram_user_id="ig_a", instagram_username="orga")
    )
    user_a.edu_email = "a-remind@school.edu"
    user_b = await persist(
        db_session, make_user(instagram_user_id="ig_b", instagram_username="orgb")
    )
    user_b.edu_email = "b-remind@school.edu"
    org_a = await make_org(db_session, user_a, org_name="Org A")
    org_b = await make_org(db_session, user_b, org_name="Org B")
    brand = await make_brand(db_session)
    drop = await make_drop(
        db_session,
        brand,
        apply_open_at=now + timedelta(minutes=10),
        apply_close_at=now + timedelta(days=7),
    )
    notify_a = await make_notify(db_session, org_a, drop, reminder_minutes=15)
    notify_b = await make_notify(db_session, org_b, drop, reminder_minutes=15)
    keys: list[str | None] = []
    failed_a = {"done": False}

    async def _flaky(to_email, *, org_name="", drop_title="", brand_name="", idempotency_key=None):
        keys.append(idempotency_key)
        if to_email == user_a.edu_email and not failed_a["done"]:
            failed_a["done"] = True
            return False
        return True

    monkeypatch.setattr(
        "app.jobs.notify_reminders.send_drop_opening_reminder_email",
        _flaky,
    )
    first = await send_due_reminders(db_session)
    assert notify_a.sent_at is None
    assert first["reminders_sent"] == 1
    second = await send_due_reminders(db_session)
    assert second["reminders_sent"] == 1
    assert notify_a.sent_at is not None
    expected_a = email.build_idempotency_key(email.KIND_REMINDER, notify_a.id)
    expected_b = email.build_idempotency_key(email.KIND_REMINDER, notify_b.id)
    assert keys.count(expected_a) == 2
    assert expected_b in keys
    assert expected_a != expected_b
    assert user_a.edu_email not in (expected_a or "")
    assert user_b.edu_email not in (expected_b or "")
