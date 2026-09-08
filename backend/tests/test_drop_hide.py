"""Admin hide/unhide published drops (PRODUCT §5.2.2)."""

from __future__ import annotations

from datetime import datetime, timezone

from httpx import AsyncClient

from app.models.enums import ApplicationDecision, BrandTrackerStage, PortalRole
from tests.conftest import (
    make_application,
    make_brand,
    make_drop,
    make_drop_request,
    make_org,
    make_user,
    mint_access_token,
    persist,
)


async def _admin_headers(db_session) -> dict:
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


class TestHideUnhideDrop:
    async def test_hide_unpublished_rejected(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, title="Draft", published_at=None)
        res = await app_client.post(
            f"/api/admin/drops/{drop.id}/hide",
            json={"confirm": "Draft"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400
        assert drop.hidden_at is None

    async def test_hide_wrong_title_rejected(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, title="Spring Drop")
        res = await app_client.post(
            f"/api/admin/drops/{drop.id}/hide",
            json={"confirm": "spring drop"},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400
        await db_session.refresh(drop)
        assert drop.hidden_at is None

    async def test_hide_and_unhide(self, app_client: AsyncClient, db_session, monkeypatch):
        mailed: list[str] = []

        async def _capture(to_email, **_kwargs):
            mailed.append(to_email)
            return True

        monkeypatch.setattr("app.services.admin.send_drop_hidden_email", _capture)

        brand = await make_brand(db_session, company_email="ops@acme.test")
        drop = await make_drop(db_session, brand, title="Spring Drop")
        headers = await _admin_headers(db_session)

        hidden = await app_client.post(
            f"/api/admin/drops/{drop.id}/hide",
            json={"confirm": "Spring Drop"},
            headers=headers,
        )
        assert hidden.status_code == 200
        assert hidden.json()["data"]["hiddenAt"] is not None
        assert mailed == []

        again = await app_client.post(
            f"/api/admin/drops/{drop.id}/hide",
            json={"confirm": "Spring Drop", "notifyBrand": True},
            headers=headers,
        )
        assert again.status_code == 200
        assert mailed == []

        shown = await app_client.post(
            f"/api/admin/drops/{drop.id}/unhide",
            headers=headers,
        )
        assert shown.status_code == 200
        assert shown.json()["data"]["hiddenAt"] is None

        with_mail = await app_client.post(
            f"/api/admin/drops/{drop.id}/hide",
            json={"confirm": " Spring Drop ", "notifyBrand": True},
            headers=headers,
        )
        assert with_mail.status_code == 200
        assert mailed == ["ops@acme.test"]

    async def test_admin_list_omits_hidden_unless_filtered(
        self, app_client: AsyncClient, db_session
    ):
        brand = await make_brand(db_session)
        live = await make_drop(db_session, brand, title="Live")
        buried = await make_drop(db_session, brand, title="Buried")
        buried.hidden_at = datetime.now(timezone.utc)
        await db_session.flush()
        headers = await _admin_headers(db_session)

        default = await app_client.get("/api/admin/drops", headers=headers)
        titles = [r["title"] for r in default.json()["data"]]
        assert "Live" in titles
        assert "Buried" not in titles

        only_hidden = await app_client.get("/api/admin/drops?hidden=true", headers=headers)
        hidden_titles = [r["title"] for r in only_hidden.json()["data"]]
        assert hidden_titles == ["Buried"]

        detail = await app_client.get(f"/api/admin/drops/{buried.id}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["data"]["id"] == str(buried.id)
        assert live.title == "Live"

    async def test_org_and_brand_consumers_lose_the_drop(self, app_client: AsyncClient, db_session):
        org_user = await persist(db_session, make_user())
        org = await make_org(db_session, org_user)
        brand_user = await persist(db_session, make_user(role=PortalRole.BRAND))
        brand = await make_brand(db_session, company_email="ops@acme.test")
        brand.user_id = brand_user.id
        await db_session.flush()
        drop = await make_drop(
            db_session, brand, title="Gone", stage=BrandTrackerStage.AWAITING_PRODUCTS
        )
        app = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
        ticket = await make_drop_request(db_session, brand)
        ticket.converted_drop_id = drop.id
        ticket.status = "converted"
        drop.hidden_at = datetime.now(timezone.utc)
        await db_session.flush()

        org_h = {"Authorization": f"Bearer {mint_access_token(org_user)}"}
        brand_h = {"Authorization": f"Bearer {mint_access_token(brand_user)}"}

        feed = await app_client.get("/api/drops", headers=org_h)
        assert feed.json()["data"] == []

        detail = await app_client.get(f"/api/drops/{drop.id}", headers=org_h)
        assert detail.status_code == 400
        assert detail.json()["error"]["code"] == "DROP_NOT_OPEN"

        apply = await app_client.post(f"/api/drops/{drop.id}/apply", headers=org_h, json={})
        assert apply.status_code == 400
        assert apply.json()["error"]["code"] == "DROP_NOT_OPEN"

        campaigns = await app_client.get("/api/campaigns", headers=org_h)
        assert campaigns.json()["data"] == []
        one = await app_client.get(f"/api/campaigns/{app.id}", headers=org_h)
        assert one.status_code == 404

        brand_list = await app_client.get("/api/brands/me/drops", headers=brand_h)
        assert brand_list.json()["data"] == []
        brand_detail = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=brand_h)
        assert brand_detail.status_code == 404

        tickets = await app_client.get("/api/brands/me/drop-requests", headers=brand_h)
        assert tickets.json()["data"][0]["convertedDropId"] is None

    async def test_hidden_drop_not_in_no_tracking_health(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(
            db_session, brand, title="No TN", stage=BrandTrackerStage.AWAITING_PRODUCTS
        )
        drop.hidden_at = datetime.now(timezone.utc)
        await db_session.flush()

        res = await app_client.get("/api/admin/health", headers=await _admin_headers(db_session))
        signal = next(
            item
            for item in res.json()["data"]["integrity"]
            if item["key"] == "awaiting_products_no_tracking"
        )
        assert signal["count"] == 0
        assert signal["ok"] is True
