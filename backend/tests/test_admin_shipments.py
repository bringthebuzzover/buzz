"""Per-org shipments (PRODUCT §3.1.1)."""

from __future__ import annotations

from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from httpx import AsyncClient

from app.models.brand import Brand
from app.models.enums import ApplicationDecision, PortalRole
from app.models.shipment import DropApplicationShipment
from app.models.user import User
from app.services import drop_notices
from app.services.shipments import infer_carrier
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


async def _accepted_seat(db_session):
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    org_user = await persist(db_session, make_user(role=PortalRole.ORG))
    org = await make_org(db_session, org_user)
    app = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
    return drop, org_user, app


class TestInferCarrier:
    def test_ups_1z(self):
        assert infer_carrier("1Z3V817W0392590700") == "ups"

    def test_fedex_digits(self):
        assert infer_carrier("876654644443") == "fedex"

    def test_unknown(self):
        assert infer_carrier("NW-TRK-001") == "unknown"


class TestAdminShipments:
    async def test_zero_one_n_and_mixed(self, app_client: AsyncClient, db_session):
        drop, org_user, app = await _accepted_seat(db_session)
        headers = await admin_headers(db_session)

        empty = await app_client.get(f"/api/admin/drops/{drop.id}", headers=headers)
        assert empty.status_code == 200
        assert empty.json()["data"]["applicants"][0]["shipments"] == []

        ups = await app_client.post(
            f"/api/admin/applications/{app.id}/shipments",
            json={"trackingNumber": "1Z3V817W0392590700"},
            headers=headers,
        )
        assert ups.status_code == 200, ups.text
        assert ups.json()["data"]["carrier"] == "ups"
        assert "ups.com/track" in (ups.json()["data"]["trackUrl"] or "")

        fedex = await app_client.post(
            f"/api/admin/applications/{app.id}/shipments",
            json={"trackingNumber": "876654644443"},
            headers=headers,
        )
        assert fedex.status_code == 200
        assert fedex.json()["data"]["carrier"] == "fedex"

        detail = await app_client.get(f"/api/admin/drops/{drop.id}", headers=headers)
        numbers = [s["trackingNumber"] for s in detail.json()["data"]["applicants"][0]["shipments"]]
        assert set(numbers) == {"1Z3V817W0392590700", "876654644443"}

    async def test_infer_override_and_unknown_requires_pick(
        self, app_client: AsyncClient, db_session
    ):
        _, _, app = await _accepted_seat(db_session)
        headers = await admin_headers(db_session)
        missing = await app_client.post(
            f"/api/admin/applications/{app.id}/shipments",
            json={"trackingNumber": "NW-TRK-001"},
            headers=headers,
        )
        assert missing.status_code == 400
        picked = await app_client.post(
            f"/api/admin/applications/{app.id}/shipments",
            json={"trackingNumber": "NW-TRK-001", "carrier": "unknown"},
            headers=headers,
        )
        assert picked.status_code == 200
        override = await app_client.post(
            f"/api/admin/applications/{app.id}/shipments",
            json={"trackingNumber": "1ZOVERRIDE", "carrier": "fedex"},
            headers=headers,
        )
        assert override.status_code == 200
        assert override.json()["data"]["carrier"] == "fedex"

    async def test_unsent_acceptance_has_no_tracking(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        org = await make_org(db_session, await persist(db_session, make_user(role=PortalRole.ORG)))
        app = await make_application(
            db_session, drop, org, decision=ApplicationDecision.ACCEPTED, sent=False
        )
        res = await app_client.post(
            f"/api/admin/applications/{app.id}/shipments",
            json={"trackingNumber": "1Z3V817W0392590700"},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 400

    async def test_uniqueness(self, app_client: AsyncClient, db_session):
        _, _, app = await _accepted_seat(db_session)
        headers = await admin_headers(db_session)
        body = {"trackingNumber": "1ZAAA"}
        assert (
            await app_client.post(
                f"/api/admin/applications/{app.id}/shipments", json=body, headers=headers
            )
        ).status_code == 200
        again = await app_client.post(
            f"/api/admin/applications/{app.id}/shipments", json=body, headers=headers
        )
        assert again.status_code == 409

    async def test_org_isolation(self, app_client: AsyncClient, db_session):
        drop, org_a, app_a = await _accepted_seat(db_session)
        org_b_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org_b = await make_org(db_session, org_b_user)
        app_b = await make_application(
            db_session, drop, org_b, decision=ApplicationDecision.ACCEPTED
        )
        headers = await admin_headers(db_session)
        await app_client.post(
            f"/api/admin/applications/{app_a.id}/shipments",
            json={"trackingNumber": "1ZONLYA"},
            headers=headers,
        )
        camp_b = await app_client.get(
            f"/api/campaigns/{app_b.id}",
            headers={"Authorization": f"Bearer {mint_access_token(org_b_user)}"},
        )
        assert camp_b.status_code == 200
        assert camp_b.json()["data"]["shipments"] == []
        camp_a = await app_client.get(
            f"/api/campaigns/{app_a.id}",
            headers={"Authorization": f"Bearer {mint_access_token(org_a)}"},
        )
        assert [s["trackingNumber"] for s in camp_a.json()["data"]["shipments"]] == ["1ZONLYA"]
        other = await app_client.get(
            f"/api/campaigns/{app_a.id}",
            headers={"Authorization": f"Bearer {mint_access_token(org_b_user)}"},
        )
        assert other.status_code == 404

    async def test_applied_rejected(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, org_user)
        app = await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)
        res = await app_client.post(
            f"/api/admin/applications/{app.id}/shipments",
            json={"trackingNumber": "1ZNO"},
            headers=await admin_headers(db_session),
        )
        assert res.status_code == 400

    async def test_delete(self, app_client: AsyncClient, db_session):
        _, _, app = await _accepted_seat(db_session)
        headers = await admin_headers(db_session)
        created = await app_client.post(
            f"/api/admin/applications/{app.id}/shipments",
            json={"trackingNumber": "1ZDEL"},
            headers=headers,
        )
        sid = created.json()["data"]["id"]
        gone = await app_client.delete(
            f"/api/admin/applications/{app.id}/shipments/{sid}",
            headers=headers,
        )
        assert gone.status_code == 200
        leftover = await db_session.get(DropApplicationShipment, UUID(sid))
        assert leftover is None


class TestBrandSeesPerOrg:
    async def test_brand_detail_lists_seat_shipments(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, org_user)
        app = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
        headers = await admin_headers(db_session)
        await app_client.post(
            f"/api/admin/applications/{app.id}/shipments",
            json={"trackingNumber": "1ZBRAND"},
            headers=headers,
        )
        brand_user = await db_session.get(User, brand.user_id)
        brand_headers = {"Authorization": f"Bearer {mint_access_token(brand_user)}"}
        res = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=brand_headers)
        assert res.status_code == 200
        assert "trackingNumber" not in res.json()["data"]
        seat = res.json()["data"]["applications"][0]
        assert [s["trackingNumber"] for s in seat["shipments"]] == ["1ZBRAND"]


class TestBrandShipmentEditing:
    async def test_own_drop_crud(self, app_client: AsyncClient, db_session):
        drop, _, seat = await _accepted_seat(db_session)
        brand_user = await _brand_user(db_session, drop)
        headers = {"Authorization": f"Bearer {mint_access_token(brand_user)}"}
        url = f"/api/brands/me/drops/{drop.id}/applications/{seat.id}/shipments"
        created = await app_client.post(url, json={"trackingNumber": "1ZORIGINAL"}, headers=headers)
        assert created.status_code == 200, created.text
        shipment_id = created.json()["data"]["id"]
        listed = await app_client.get(url, headers=headers)
        assert listed.status_code == 200
        assert [s["id"] for s in listed.json()["data"]] == [shipment_id]
        updated = await app_client.patch(
            f"{url}/{shipment_id}",
            json={"trackingNumber": " 123456789012 ", "carrier": "fedex"},
            headers=headers,
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["data"]["trackingNumber"] == "123456789012"
        assert updated.json()["data"]["carrier"] == "fedex"
        assert "fedex.com" in updated.json()["data"]["trackUrl"]
        unchanged = await app_client.patch(
            f"{url}/{shipment_id}",
            json={"trackingNumber": "123456789012"},
            headers=headers,
        )
        assert unchanged.status_code == 200
        duplicate = await app_client.post(url, json={"trackingNumber": "1ZSECOND"}, headers=headers)
        conflict = await app_client.patch(
            f"{url}/{shipment_id}", json={"trackingNumber": "1ZSECOND"}, headers=headers
        )
        assert duplicate.status_code == 200
        assert conflict.status_code == 409
        removed = await app_client.delete(f"{url}/{shipment_id}", headers=headers)
        assert removed.status_code == 200
        assert await db_session.get(DropApplicationShipment, UUID(shipment_id)) is None

    async def test_canceled_drop_cannot_delete_shipment(self, app_client: AsyncClient, db_session):
        drop, _, seat = await _accepted_seat(db_session)
        brand_user = await _brand_user(db_session, drop)
        shipment = await persist(
            db_session,
            DropApplicationShipment(
                application_id=seat.id, tracking_number="1ZCANCELED", carrier="ups"
            ),
        )
        drop.canceled_at = utcnow()
        await db_session.flush()

        result = await app_client.delete(
            f"/api/brands/me/drops/{drop.id}/applications/{seat.id}/shipments/{shipment.id}",
            headers={"Authorization": f"Bearer {mint_access_token(brand_user)}"},
        )

        assert result.status_code == 409, result.text
        assert result.json()["error"]["code"] == "DROP_CANCELED"
        await db_session.refresh(shipment)
        assert shipment.tracking_number == "1ZCANCELED"

    @pytest.mark.parametrize("method", ["GET", "POST", "PATCH", "DELETE"])
    @pytest.mark.parametrize("scope", ["other_drop", "other_seat", "mismatched_drop"])
    async def test_other_brand_scope(self, app_client: AsyncClient, db_session, method, scope):
        drop, _, seat = await _accepted_seat(db_session)
        other_drop, _, other_seat = await _accepted_seat(db_session)
        brand_user = await _brand_user(db_session, drop)
        headers = {"Authorization": f"Bearer {mint_access_token(brand_user)}"}
        shipment = await persist(
            db_session,
            DropApplicationShipment(
                application_id=other_seat.id, tracking_number="1ZOTHER", carrier="ups"
            ),
        )
        target_drop = drop if scope == "other_seat" else other_drop
        target_seat = seat if scope == "mismatched_drop" else other_seat
        url = f"/api/brands/me/drops/{target_drop.id}/applications/{target_seat.id}/shipments"
        if method in ("PATCH", "DELETE"):
            url += f"/{shipment.id}"
        kwargs = {"json": {"trackingNumber": "1ZATTEMPT"}} if method in ("POST", "PATCH") else {}
        result = await app_client.request(method, url, headers=headers, **kwargs)
        assert result.status_code == 404, result.text
        await db_session.refresh(shipment)
        assert shipment.tracking_number == "1ZOTHER"

    @pytest.mark.parametrize("method", ["PATCH", "DELETE"])
    async def test_foreign_shipment_rejected(self, app_client: AsyncClient, db_session, method):
        drop, _, seat = await _accepted_seat(db_session)
        _, _, other_seat = await _accepted_seat(db_session)
        brand_user = await _brand_user(db_session, drop)
        shipment = await persist(
            db_session,
            DropApplicationShipment(
                application_id=other_seat.id, tracking_number="1ZOTHER", carrier="ups"
            ),
        )
        url = f"/api/brands/me/drops/{drop.id}/applications/{seat.id}/shipments/{shipment.id}"
        kwargs = {"json": {"trackingNumber": "1ZATTEMPT"}} if method == "PATCH" else {}
        result = await app_client.request(
            method,
            url,
            headers={"Authorization": f"Bearer {mint_access_token(brand_user)}"},
            **kwargs,
        )
        assert result.status_code == 404
        await db_session.refresh(shipment)
        assert shipment.tracking_number == "1ZOTHER"

    @pytest.mark.parametrize("method", ["GET", "POST", "PATCH", "DELETE"])
    @pytest.mark.parametrize("role", [PortalRole.ORG, PortalRole.ADMIN])
    async def test_non_brand_rejected(self, app_client: AsyncClient, db_session, method, role):
        drop, _, seat = await _accepted_seat(db_session)
        user = await persist(db_session, make_user(role=role))
        url = f"/api/brands/me/drops/{drop.id}/applications/{seat.id}/shipments"
        if method in ("PATCH", "DELETE"):
            url += f"/{seat.id}"
        kwargs = {"json": {"trackingNumber": "1ZATTEMPT"}} if method in ("POST", "PATCH") else {}
        result = await app_client.request(
            method, url, headers={"Authorization": f"Bearer {mint_access_token(user)}"}, **kwargs
        )
        assert result.status_code == 403


async def _brand_user(db_session, drop):
    brand = await db_session.get(Brand, drop.brand_id)
    return await db_session.get(User, brand.user_id)


@pytest.mark.parametrize("portal", ["admin", "brand"])
async def test_shipment_email_is_deferred(app_client: AsyncClient, db_session, monkeypatch, portal):
    drop, org_user, seat = await _accepted_seat(db_session)
    org_user.edu_email = "org1@example.edu"
    await db_session.flush()
    if portal == "admin":
        headers = await admin_headers(db_session)
        url = f"/api/admin/applications/{seat.id}/shipments"
    else:
        user = await _brand_user(db_session, drop)
        headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        url = f"/api/brands/me/drops/{drop.id}/applications/{seat.id}/shipments"

    sender = AsyncMock(return_value=True)
    monkeypatch.setattr(drop_notices, "_send", sender)
    schedule = drop_notices.schedule_email

    async def assert_deferred(tasks, *args, **kwargs):
        assert tasks is not None
        result = await schedule(tasks, *args, **kwargs)
        sender.assert_not_awaited()
        return result

    monkeypatch.setattr(drop_notices, "schedule_email", assert_deferred)
    result = await app_client.post(url, json={"trackingNumber": "1ZDEFERRED"}, headers=headers)
    assert result.status_code == 200, result.text
    sender.assert_awaited_once()
