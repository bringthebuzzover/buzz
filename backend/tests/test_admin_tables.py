"""Admin table inspect + allowlisted patch (ideas/archive/admin-mcp.md)."""

from __future__ import annotations

from httpx import AsyncClient

from app.models.enums import ApplicationDecision, PortalRole
from app.models.shipment import DropApplicationShipment
from app.security.password import hash_password
from tests.conftest import (
    make_application,
    make_brand,
    make_drop,
    make_notify,
    make_org,
    make_user,
    mint_access_token,
    persist,
)


async def _admin_headers(db_session) -> dict[str, str]:
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


class TestAdminTablesGate:
    async def test_non_admin_forbidden(self, app_client: AsyncClient, db_session) -> None:
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        headers = {"Authorization": f"Bearer {mint_access_token(org_user)}"}
        res = await app_client.get("/api/admin/tables", headers=headers)
        assert res.status_code == 403

    async def test_unauthorized(self, app_client: AsyncClient) -> None:
        res = await app_client.get("/api/admin/tables")
        assert res.status_code == 401


class TestAdminTablesCatalog:
    async def test_lists_all_tables_and_flags_secrets(
        self, app_client: AsyncClient, db_session
    ) -> None:
        res = await app_client.get("/api/admin/tables", headers=await _admin_headers(db_session))
        assert res.status_code == 200
        by_name = {item["name"]: item for item in res.json()["data"]}
        assert "users" in by_name
        assert "drop_application_shipments" in by_name
        assert "org_ig_change_requests" in by_name
        assert "drop_apply_intents" in by_name
        assert by_name["drop_apply_intents"]["writable"] is False
        assert by_name["org_ig_change_requests"]["writable"] is False
        users_cols = {col["name"]: col for col in by_name["users"]["columns"]}
        assert users_cols["passwordHash"]["hidden"] is True
        assert users_cols["instagramAccessToken"]["hidden"] is True
        assert users_cols["tokenVersion"]["hidden"] is True
        assert users_cols["eduEmail"]["hidden"] is False
        assert users_cols["eduEmail"]["writable"] is True
        assert users_cols["status"]["writable"] is False


class TestAdminTablesQuery:
    async def test_redacts_user_secrets(self, app_client: AsyncClient, db_session) -> None:
        user = make_user(role=PortalRole.ORG)
        user.password_hash = hash_password("not-a-real-password")
        user.instagram_access_token = "IG_SECRET_TOKEN"
        user.edu_email = "club@college.edu"
        await persist(db_session, user)

        res = await app_client.post(
            "/api/admin/tables/users/query",
            json={"filters": {"eduEmail": "club@college.edu"}},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200
        rows = res.json()["data"]["rows"]
        assert len(rows) == 1
        assert rows[0]["eduEmail"] == "club@college.edu"
        assert "passwordHash" not in rows[0]
        assert "instagramAccessToken" not in rows[0]
        assert "tokenVersion" not in rows[0]
        assert "instagramUserId" not in rows[0]

    async def test_unknown_table(self, app_client: AsyncClient, db_session) -> None:
        res = await app_client.post(
            "/api/admin/tables/nope/query",
            json={},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 404

    async def test_rejects_hidden_filter(self, app_client: AsyncClient, db_session) -> None:
        res = await app_client.post(
            "/api/admin/tables/users/query",
            json={"filters": {"passwordHash": "x"}},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400


class TestAdminTablesPatch:
    async def test_rejects_secret_column(self, app_client: AsyncClient, db_session) -> None:
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        res = await app_client.patch(
            f"/api/admin/tables/users/{user.id}",
            json={"fields": {"passwordHash": "x"}},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400

    async def test_rejects_status_machine(self, app_client: AsyncClient, db_session) -> None:
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        res = await app_client.patch(
            f"/api/admin/tables/users/{user.id}",
            json={"fields": {"status": "active"}},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400

    async def test_patches_org_shipping(self, app_client: AsyncClient, db_session) -> None:
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, user, org_name="Ship Club")
        res = await app_client.patch(
            f"/api/admin/tables/organizations/{org.id}",
            json={
                "fields": {
                    "shippingLine1": "123 College Ave",
                    "shippingCity": "Ithaca",
                    "shippingState": "NY",
                    "shippingPostalCode": "14850",
                }
            },
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200
        row = res.json()["data"]["row"]
        assert row["shippingLine1"] == "123 College Ave"
        assert row["deliveryAddress"] == "123 College Ave, Ithaca, NY 14850"

    async def test_patches_drop_title(self, app_client: AsyncClient, db_session) -> None:
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, title="Old Title")
        res = await app_client.patch(
            f"/api/admin/tables/drops/{drop.id}",
            json={"fields": {"title": "New Title"}},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200
        assert res.json()["data"]["row"]["title"] == "New Title"

    async def test_get_row(self, app_client: AsyncClient, db_session) -> None:
        brand = await make_brand(db_session, brand_name="Acme")
        res = await app_client.get(
            f"/api/admin/tables/brands/{brand.id}",
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 200
        assert res.json()["data"]["row"]["brandName"] == "Acme"

    async def test_rejects_duplicate_shipment_tracking(
        self, app_client: AsyncClient, db_session
    ) -> None:
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, user)
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        app = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
        first = DropApplicationShipment(
            application_id=app.id, tracking_number="1ZAAAA", carrier="ups"
        )
        second = DropApplicationShipment(
            application_id=app.id, tracking_number="1ZBBBB", carrier="ups"
        )
        db_session.add_all([first, second])
        await db_session.flush()

        res = await app_client.patch(
            f"/api/admin/tables/drop_application_shipments/{second.id}",
            json={"fields": {"trackingNumber": "1ZAAAA"}},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 409
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"

    async def test_rejects_non_numeric_notify_minutes(
        self, app_client: AsyncClient, db_session
    ) -> None:
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, user)
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        notify = await make_notify(db_session, org, drop)

        res = await app_client.patch(
            f"/api/admin/tables/notify_me/{notify.id}",
            json={"fields": {"reminderMinutes": "soon"}},
            headers=await _admin_headers(db_session),
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"
