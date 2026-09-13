"""Admin brand hybrid erase (PRODUCT §3.1.3 / §4.3)."""

from __future__ import annotations

from unittest.mock import AsyncMock

from httpx import AsyncClient
from sqlalchemy import select

from app.models.application import DropApplication
from app.models.brand import Brand
from app.models.drop import Drop
from app.models.enums import ApplicationDecision, BrandStatus, BrandTrackerStage, PortalRole
from app.models.shipment import DropApplicationShipment
from app.models.user import User
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


async def _live_brand(db_session):
    brand = await make_brand(db_session, company_email="acme@brand.test")
    brand.instagram_handle = "acme"
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_ACTIVE)
    org_user = await persist(db_session, make_user(role=PortalRole.ORG))
    org = await make_org(db_session, org_user, org_name="Campus Club")
    app = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
    db_session.add(
        DropApplicationShipment(
            application_id=app.id,
            tracking_number="1Z999AA10123456784",
            carrier="ups",
        )
    )
    await db_session.flush()
    return brand, drop, org_user, app


class TestAdminBrandErase:
    async def test_erases_and_keeps_history(self, app_client: AsyncClient, db_session, monkeypatch):
        monkeypatch.setattr(
            "app.services.admin_erase.send_brand_erased_email",
            AsyncMock(return_value=True),
        )
        brand, drop, org_user, app = await _live_brand(db_session)
        brand_user = await db_session.get(User, brand.user_id)
        assert brand_user is not None
        brand_user.token_version = 1
        await db_session.flush()
        hidden_before = drop.hidden_at
        headers = await _admin_headers(db_session)
        res = await app_client.post(
            f"/api/admin/brands/{brand.id}/erase",
            json={"confirm": "acme@brand.test"},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["status"] == "erased"
        assert data["emailSent"] is True

        await db_session.refresh(brand)
        user = await db_session.get(User, brand.user_id)
        assert brand.status == BrandStatus.ERASED.value
        assert brand.brand_name == "Deleted brand"
        assert brand.instagram_handle is None
        assert brand.company_email.startswith("erased+")
        assert user is not None and user.status == "erased"
        assert user.password_hash is None
        assert user.token_version == 2
        await db_session.refresh(drop)
        assert drop.hidden_at == hidden_before
        kept = await db_session.get(DropApplication, app.id)
        assert kept is not None
        ship = await db_session.scalar(
            select(DropApplicationShipment).where(DropApplicationShipment.application_id == app.id)
        )
        assert ship is not None

        campaigns = await app_client.get(
            "/api/campaigns",
            headers={"Authorization": f"Bearer {mint_access_token(org_user)}"},
        )
        assert campaigns.status_code == 200
        titles = [c["brandName"] for c in campaigns.json()["data"]]
        assert "Deleted brand" in titles

        feed = await app_client.get(
            "/api/drops",
            headers={"Authorization": f"Bearer {mint_access_token(org_user)}"},
        )
        assert feed.status_code == 200
        assert all(item["id"] != str(drop.id) for item in feed.json()["data"])

    async def test_tools_409_after_erase(self, app_client: AsyncClient, db_session):
        brand, drop, _org_user, _app = await _live_brand(db_session)
        headers = await _admin_headers(db_session)
        wiped = await app_client.post(
            f"/api/admin/brands/{brand.id}/erase",
            json={"confirm": "acme@brand.test"},
            headers=headers,
        )
        assert wiped.status_code == 200
        compose = await app_client.post(
            f"/api/admin/brands/{brand.id}/send-email",
            json={"subject": "Hi", "body": "Hello"},
            headers=headers,
        )
        assert compose.status_code == 409
        other_user = await persist(db_session, make_user(role=PortalRole.ORG))
        other = await make_org(db_session, other_user, org_name="Extra")
        late = await app_client.post(
            f"/api/admin/drops/{drop.id}/add-org",
            json={"orgId": str(other.id)},
            headers=headers,
        )
        assert late.status_code == 409
        sync = await app_client.post(
            f"/api/admin/drops/{drop.id}/sync-and-autolink",
            headers=headers,
        )
        assert sync.status_code == 409

    async def test_wrong_confirm_and_idempotent(self, app_client: AsyncClient, db_session):
        brand, _drop, _org_user, _app = await _live_brand(db_session)
        headers = await _admin_headers(db_session)
        bad = await app_client.post(
            f"/api/admin/brands/{brand.id}/erase",
            json={"confirm": "wrong@x.test"},
            headers=headers,
        )
        assert bad.status_code == 400
        first = await app_client.post(
            f"/api/admin/brands/{brand.id}/erase",
            json={"confirm": "ACME@brand.test"},
            headers=headers,
        )
        assert first.status_code == 200
        again = await app_client.post(
            f"/api/admin/brands/{brand.id}/erase",
            json={"confirm": "acme@brand.test"},
            headers=headers,
        )
        assert again.status_code == 200
        assert again.json()["data"]["emailSent"] is False
        assert await db_session.get(Brand, brand.id)
        assert await db_session.get(Drop, _drop.id)

    async def test_erase_commits_the_bump(self, db_session, monkeypatch):
        from app.services.admin_erase import erase_brand

        monkeypatch.setattr(
            "app.services.admin_erase.send_brand_erased_email",
            AsyncMock(return_value=True),
        )
        brand, *_ = await _live_brand(db_session)
        commits: list[int] = []
        original = db_session.commit

        async def spy() -> None:
            commits.append(1)
            await original()

        monkeypatch.setattr(db_session, "commit", spy)
        await erase_brand(db_session, brand.id, "acme@brand.test")
        assert commits, "erase_brand must commit the token_version bump itself"

    async def test_list_default_excludes_erased(self, app_client: AsyncClient, db_session):
        live, *_ = await _live_brand(db_session)
        erased_brand = await make_brand(db_session, company_email="gone@brand.test")
        erased_brand.status = BrandStatus.ERASED.value
        await db_session.flush()
        headers = await _admin_headers(db_session)

        all_res = await app_client.get("/api/admin/brands", headers=headers)
        ids = {row["id"] for row in all_res.json()["data"]}
        assert str(live.id) in ids
        assert str(erased_brand.id) not in ids

        erased_res = await app_client.get("/api/admin/brands?status=erased", headers=headers)
        erased_ids = {row["id"] for row in erased_res.json()["data"]}
        assert str(erased_brand.id) in erased_ids
        assert str(live.id) not in erased_ids
