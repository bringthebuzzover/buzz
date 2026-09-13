"""Admin compose email (PRODUCT §10)."""

from __future__ import annotations

from unittest.mock import AsyncMock

from httpx import AsyncClient

from app.brand_emails import CONTACT_EMAIL, OPS_CC_EMAIL
from app.models.enums import OrgUserStatus, PortalRole
from tests.conftest import (
    make_brand,
    make_org,
    make_user,
    mint_access_token,
    persist,
)


async def _admin_headers(db_session) -> dict:
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


class TestAdminComposeEmail:
    async def test_org_send_happy(self, app_client: AsyncClient, db_session, monkeypatch):
        captured: dict = {}

        async def _send(to_email, subject, body):
            captured["to"] = to_email
            captured["subject"] = subject
            captured["body"] = body
            return True

        monkeypatch.setattr("app.services.admin.send_admin_compose_email", _send)
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        user.edu_email = "greeks@school.edu"
        await make_org(db_session, user)
        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/send-email",
            json={"subject": "Hello", "body": "Please confirm.", "to": "evil@x.test"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["to"] == "greeks@school.edu"
        assert captured["to"] == "greeks@school.edu"
        assert captured["subject"] == "Hello"
        assert CONTACT_EMAIL in data["cc"] or OPS_CC_EMAIL in data["cc"]
        assert "greeks@school.edu" not in [a.lower() for a in data["cc"]]

    async def test_org_empty_400(self, app_client: AsyncClient, db_session):
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        user.edu_email = "greeks@school.edu"
        await make_org(db_session, user)
        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/send-email",
            json={"subject": "  ", "body": "hi"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"

    async def test_org_no_email_400(self, app_client: AsyncClient, db_session):
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        user.edu_email = None
        user.status = OrgUserStatus.ERASED.value
        await make_org(db_session, user)
        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/send-email",
            json={"subject": "Hi", "body": "Hello"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400

    async def test_org_unknown_404(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            "/api/admin/orgs/00000000-0000-0000-0000-000000000001/send-email",
            json={"subject": "Hi", "body": "Hello"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 404

    async def test_org_send_failed_502(self, app_client: AsyncClient, db_session, monkeypatch):
        monkeypatch.setattr(
            "app.services.admin.send_admin_compose_email",
            AsyncMock(return_value=False),
        )
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        user.edu_email = "greeks@school.edu"
        await make_org(db_session, user)
        res = await app_client.post(
            f"/api/admin/orgs/{user.id}/send-email",
            json={"subject": "Hi", "body": "Hello"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 502
        assert res.json()["error"]["code"] == "EMAIL_SEND_FAILED"

    async def test_brand_send_happy(self, app_client: AsyncClient, db_session, monkeypatch):
        async def _send(to_email, subject, body):
            assert to_email == "acme@brand.test"
            return True

        monkeypatch.setattr("app.services.admin.send_admin_compose_email", _send)
        brand = await make_brand(db_session, company_email="acme@brand.test")
        res = await app_client.post(
            f"/api/admin/brands/{brand.id}/send-email",
            json={"subject": "Check-in", "body": "How is the drop going?"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200, res.text
        assert res.json()["data"]["to"] == "acme@brand.test"

    async def test_dispatch_cc_and_html_escape(self, monkeypatch):
        from app.services import email as email_mod

        captured: dict = {}

        async def _dispatch(to_email, subject, body, *, html=None, cc=None):
            captured["to"] = to_email
            captured["html"] = html
            captured["cc"] = cc
            captured["body"] = body
            return True

        monkeypatch.setattr(email_mod.settings, "ENVIRONMENT", "production")
        monkeypatch.setattr(email_mod.settings, "RESEND_API_KEY", "re_test")
        monkeypatch.setattr(email_mod, "_dispatch", _dispatch)
        sent = await email_mod.send_admin_compose_email(
            "org@school.edu", "Sub <x>", "Hello <script>alert(1)</script>"
        )
        assert sent is True
        assert captured["to"] == "org@school.edu"
        assert CONTACT_EMAIL in captured["cc"]
        assert OPS_CC_EMAIL in captured["cc"]
        assert "<script>" not in captured["html"]
        assert "&lt;script&gt;" in captured["html"]
