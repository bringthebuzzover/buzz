"""Per-org shipments (PRODUCT §3.1.1)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from httpx import AsyncClient

from app.models.enums import ApplicationDecision, BrandTrackerStage, PortalRole
from app.models.shipment import DropApplicationShipment
from app.services.shipments import infer_carrier
from tests.conftest import (
    make_application,
    make_brand,
    make_drop,
    make_org,
    make_user,
    mint_access_token,
    persist,
)


async def _admin_headers(db_session) -> dict:
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


async def _accepted_seat(db_session):
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.AWAITING_PRODUCTS)
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
        headers = await _admin_headers(db_session)

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
        headers = await _admin_headers(db_session)
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

    async def test_uniqueness(self, app_client: AsyncClient, db_session):
        _, _, app = await _accepted_seat(db_session)
        headers = await _admin_headers(db_session)
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
        headers = await _admin_headers(db_session)
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

    async def test_advance_without_tn(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, stage=BrandTrackerStage.FINALIZING_AGREEMENTS)
        drop.applicant_selection_finalized_at = datetime.now(timezone.utc)
        await db_session.flush()
        res = await app_client.patch(
            f"/api/admin/drops/{drop.id}/tracker",
            json={"stage": "awaiting_products"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200
        await db_session.refresh(drop)
        assert drop.tracking_number is None
        assert drop.brand_tracker_stage == BrandTrackerStage.AWAITING_PRODUCTS.value

    async def test_applied_rejected(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, org_user)
        app = await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)
        res = await app_client.post(
            f"/api/admin/applications/{app.id}/shipments",
            json={"trackingNumber": "1ZNO"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400

    async def test_delete(self, app_client: AsyncClient, db_session):
        _, _, app = await _accepted_seat(db_session)
        headers = await _admin_headers(db_session)
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
        drop = await make_drop(db_session, brand, stage=BrandTrackerStage.AWAITING_PRODUCTS)
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, org_user)
        app = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
        headers = await _admin_headers(db_session)
        await app_client.post(
            f"/api/admin/applications/{app.id}/shipments",
            json={"trackingNumber": "1ZBRAND"},
            headers=headers,
        )
        from app.models.user import User

        brand_user = await db_session.get(User, brand.user_id)
        brand_headers = {"Authorization": f"Bearer {mint_access_token(brand_user)}"}
        res = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=brand_headers)
        assert res.status_code == 200
        assert "trackingNumber" not in res.json()["data"]
        seat = res.json()["data"]["applications"][0]
        assert [s["trackingNumber"] for s in seat["shipments"]] == ["1ZBRAND"]
