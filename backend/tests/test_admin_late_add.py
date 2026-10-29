"""Admin late-add org onto a published drop (PRODUCT §7.1)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

from httpx import AsyncClient
from sqlalchemy import select

from app.models.application import DropApplication
from app.models.enums import ApplicationDecision, OrgUserStatus, PortalRole
from app.timeutils import utcnow
from tests.conftest import (
    admin_headers,
    make_application,
    make_brand,
    make_drop,
    make_org,
    make_user,
    mint_access_token,
    persist,
)


async def _org(db_session, *, name: str = "Late Org", status: str = OrgUserStatus.ACTIVE.value):
    user = await persist(db_session, make_user(role=PortalRole.ORG))
    user.edu_email = f"{name.lower().replace(' ', '.')}@school.edu"
    user.status = status
    org = await make_org(db_session, user, org_name=name)
    return user, org


class TestAdminLateAdd:
    async def test_never_applied_accepted(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        _, org = await _org(db_session)
        res = await app_client.post(
            f"/api/admin/drops/{drop.id}/add-org",
            json={"orgId": str(org.id)},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["neverApplied"] is True
        assert data["portalReady"] is True
        assert data["emailOrgSent"] is None
        assert data["emailBrandSent"] is None
        row = await db_session.get(DropApplication, data["applicationId"])
        assert row is not None
        assert row.decision == ApplicationDecision.ACCEPTED.value
        assert row.allocated_units is None

    async def test_flip_applied_and_readd_after_denied(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        _, pending = await _org(db_session, name="Pending Club")
        _, denied = await _org(db_session, name="Denied Club")
        applied = await make_application(db_session, drop, pending)
        await make_application(db_session, drop, denied, decision=ApplicationDecision.DENIED)
        headers = await admin_headers(db_session)

        flip = await app_client.post(
            f"/api/admin/drops/{drop.id}/add-org",
            json={"orgId": str(pending.id)},
            headers=headers,
        )
        assert flip.status_code == 200, flip.text
        assert flip.json()["data"]["neverApplied"] is False
        assert flip.json()["data"]["applicationId"] == str(applied.id)

        again = await app_client.post(
            f"/api/admin/drops/{drop.id}/add-org",
            json={"orgId": str(denied.id)},
            headers=headers,
        )
        assert again.status_code == 200, again.text
        assert again.json()["data"]["neverApplied"] is False
        assert again.json()["data"]["applicationId"] != str(applied.id)

    async def test_already_accepted_409(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        _, org = await _org(db_session)
        await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
        res = await app_client.post(
            f"/api/admin/drops/{drop.id}/add-org",
            json={"orgId": str(org.id)},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 409
        assert res.json()["error"]["code"] == "ALREADY_ACCEPTED"

    async def test_reuses_unsent_denial(self, app_client: AsyncClient, db_session, monkeypatch):
        """An unsent denial is a draft: late-add turns it into the acceptance,
        so the next send neither emails a denial nor leaves a phantom row."""
        from app.services import drop_notices

        denials = AsyncMock(return_value=True)
        monkeypatch.setattr(drop_notices, "send_application_denied_email", denials)
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        _, org = await _org(db_session)
        draft = await make_application(
            db_session, drop, org, decision=ApplicationDecision.DENIED, sent=False
        )
        headers = await admin_headers(db_session)
        res = await app_client.post(
            f"/api/admin/drops/{drop.id}/add-org", json={"orgId": str(org.id)}, headers=headers
        )
        assert res.status_code == 200, res.text
        assert res.json()["data"]["applicationId"] == str(draft.id)
        rows = list(
            await db_session.scalars(
                select(DropApplication).where(DropApplication.drop_id == drop.id)
            )
        )
        assert [(r.decision, r.decision_sent_at is not None) for r in rows] == [
            (ApplicationDecision.ACCEPTED.value, True)
        ]
        res = await app_client.post(f"/api/admin/drops/{drop.id}/send-decisions", headers=headers)
        assert res.json()["data"] == {"acceptedCount": 0, "deniedCount": 0}
        denials.assert_not_awaited()

    async def test_refuse_erased_org(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        _, org = await _org(db_session, status=OrgUserStatus.ERASED.value)
        res = await app_client.post(
            f"/api/admin/drops/{drop.id}/add-org",
            json={"orgId": str(org.id)},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 409
        assert res.json()["error"]["code"] == "INVALID_ONBOARDING_STATE"

    async def test_refuse_draft_and_hidden(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        draft = await make_drop(db_session, brand, published_at=None)
        hidden = await make_drop(db_session, brand)
        hidden.hidden_at = datetime.now(timezone.utc)
        await db_session.flush()
        _, org = await _org(db_session)
        headers = await admin_headers(db_session)
        for drop, code in ((draft, "DROP_UNPUBLISHED"), (hidden, "DROP_HIDDEN")):
            res = await app_client.post(
                f"/api/admin/drops/{drop.id}/add-org",
                json={"orgId": str(org.id)},
                headers=headers,
            )
            assert res.status_code == 409, drop.title
            assert res.json()["error"]["code"] == code

    async def test_retro_add_to_wrapped_drop(self, app_client: AsyncClient, db_session):
        """BUZZ can seat an org on a wrapped drop (retro); it is live and sent at once."""
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, wrapped_at=utcnow())
        _, org = await _org(db_session)
        res = await app_client.post(
            f"/api/admin/drops/{drop.id}/add-org",
            json={"orgId": str(org.id)},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 200, res.text
        row = await db_session.get(DropApplication, res.json()["data"]["applicationId"])
        assert row is not None
        assert row.decision == ApplicationDecision.ACCEPTED.value
        assert row.decision_sent_at is not None

    async def test_overbook_units_then_brand_sends(self, app_client: AsyncClient, db_session):
        brand_user = await persist(db_session, make_user(role=PortalRole.BRAND))
        brand = await make_brand(db_session, company_email="ops-brand@test.com")
        brand.user_id = brand_user.id
        await db_session.flush()
        now = datetime.now(timezone.utc)
        drop = await make_drop(
            db_session,
            brand,
            capacity_total=1,
            total_product_units=10,
            apply_open_at=now - timedelta(days=10),
            apply_close_at=now - timedelta(days=1),
        )
        _, leftover = await _org(db_session, name="Leftover")
        await make_application(db_session, drop, leftover)
        _, first = await _org(db_session, name="First Seat")
        _, extra = await _org(db_session, name="Overbook Seat")
        headers = await admin_headers(db_session)
        a = await app_client.post(
            f"/api/admin/drops/{drop.id}/add-org",
            json={"orgId": str(first.id), "allocatedUnits": 8},
            headers=headers,
        )
        b = await app_client.post(
            f"/api/admin/drops/{drop.id}/add-org",
            json={"orgId": str(extra.id), "allocatedUnits": 8},
            headers=headers,
        )
        assert a.status_code == 200 and b.status_code == 200, (a.text, b.text)
        assert a.json()["data"]["neverApplied"] is True

        brand_headers = {"Authorization": f"Bearer {mint_access_token(brand_user)}"}
        leftover_app = await db_session.scalar(
            select(DropApplication).where(DropApplication.org_id == leftover.id)
        )
        deny = await app_client.put(
            f"/api/brands/me/drops/{drop.id}/applications/{leftover_app.id}/decision",
            json={"decision": "denied"},
            headers=brand_headers,
        )
        assert deny.status_code == 200, deny.text
        sent = await app_client.post(
            f"/api/brands/me/drops/{drop.id}/send-decisions", headers=brand_headers
        )
        assert sent.status_code == 200, sent.text
        # BUZZ's late adds were already sent; only the brand's denial goes out.
        assert sent.json()["data"] == {"acceptedCount": 0, "deniedCount": 1}
        first_row = await db_session.get(DropApplication, a.json()["data"]["applicationId"])
        extra_row = await db_session.get(DropApplication, b.json()["data"]["applicationId"])
        assert first_row is not None and extra_row is not None
        assert first_row.decision == ApplicationDecision.ACCEPTED.value
        assert extra_row.decision == ApplicationDecision.ACCEPTED.value

    async def test_fills_capacity_closes_apply(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, capacity_total=1)
        _, seated = await _org(db_session, name="Seated")
        apply_user, waiter = await _org(db_session, name="Waiter")
        add = await app_client.post(
            f"/api/admin/drops/{drop.id}/add-org",
            json={"orgId": str(seated.id)},
            headers=await admin_headers(db_session),
        )
        assert add.status_code == 200
        blocked = await app_client.post(
            f"/api/drops/{drop.id}/apply",
            json={},
            headers={"Authorization": f"Bearer {mint_access_token(apply_user)}"},
        )
        assert blocked.status_code == 400
        assert blocked.json()["error"]["code"] == "CAPACITY_EXCEEDED"
        assert waiter is not None

    async def test_email_fail_keeps_seat(self, app_client: AsyncClient, db_session, monkeypatch):
        monkeypatch.setattr(
            "app.services.admin.send_late_add_org_email",
            AsyncMock(return_value=False),
        )
        monkeypatch.setattr(
            "app.services.admin.send_late_add_brand_email",
            AsyncMock(return_value=False),
        )
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        _, org = await _org(db_session, status=OrgUserStatus.PENDING_APPROVAL.value)
        res = await app_client.post(
            f"/api/admin/drops/{drop.id}/add-org",
            json={
                "orgId": str(org.id),
                "emailOrg": True,
                "emailBrand": True,
            },
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["portalReady"] is False
        assert data["emailOrgSent"] is False
        assert data["emailBrandSent"] is False
        row = await db_session.get(DropApplication, data["applicationId"])
        assert row is not None
        assert row.decision == ApplicationDecision.ACCEPTED.value

    async def test_new_org_has_empty_shipments(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        _, org = await _org(db_session)
        add = await app_client.post(
            f"/api/admin/drops/{drop.id}/add-org",
            json={"orgId": str(org.id)},
            headers=await admin_headers(db_session),
        )
        assert add.status_code == 200
        detail = await app_client.get(
            f"/api/admin/drops/{drop.id}",
            headers=await admin_headers(db_session),
        )
        assert detail.status_code == 200
        seated = next(a for a in detail.json()["data"]["applicants"] if a["orgId"] == str(org.id))
        assert seated["decision"] == "accepted"
        assert seated["shipments"] == []
