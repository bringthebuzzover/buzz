"""Brand PATCH creative + admin brandCanEditCreative (frozen brand-drop-creative contract)."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import select

from app.models.drop import Drop
from app.models.enums import PortalRole
from tests.conftest import (
    make_brand,
    make_drop,
    make_user,
    mint_access_token,
    persist,
)

CREATIVE_FORBIDDEN = "Brand cannot edit"
HTTPS_IMAGE = "https://cdn.example.test/hero-brand.png"
HTTPS_IMAGE_2 = "https://cdn.example.test/hero-brand-2.png"


async def _brand_ctx(db_session):
    brand_user = await persist(db_session, make_user(role=PortalRole.BRAND))
    brand = await make_brand(db_session, brand_name="Creative Brand")
    brand.user_id = brand_user.id
    await db_session.flush()
    headers = {"Authorization": f"Bearer {mint_access_token(brand_user)}"}
    return brand_user, brand, headers


async def _admin_headers(db_session) -> dict:
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


def _brand_patch_url(drop_id) -> str:
    return f"/api/brands/me/drops/{drop_id}"


async def _set_brand_can_edit(app_client: AsyncClient, db_session, drop_id, value: bool | None):
    return await app_client.patch(
        f"/api/admin/drops/{drop_id}",
        json={"brandCanEditCreative": value},
        headers=await _admin_headers(db_session),
    )


class TestBrandDropCreativeAuthz:
    async def test_anon_401(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        res = await app_client.patch(_brand_patch_url(drop.id), json={"title": "Nope"})
        assert res.status_code == 401

    async def test_org_403(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        headers = {"Authorization": f"Bearer {mint_access_token(org_user)}"}
        res = await app_client.patch(
            _brand_patch_url(drop.id), json={"title": "Nope"}, headers=headers
        )
        assert res.status_code == 403

    async def test_other_brand_404(self, app_client: AsyncClient, db_session):
        _, _, headers = await _brand_ctx(db_session)
        other = await make_brand(db_session, brand_name="Other Creative")
        drop = await make_drop(db_session, other)
        res = await app_client.patch(
            _brand_patch_url(drop.id), json={"title": "Nope"}, headers=headers
        )
        assert res.status_code == 404


class TestAdminBrandCanEditCreativeFlag:
    async def test_null_422_then_true_then_false(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        headers = await _admin_headers(db_session)

        null = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"brandCanEditCreative": None},
            headers=headers,
        )
        assert null.status_code == 422

        on = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"brandCanEditCreative": True},
            headers=headers,
        )
        assert on.status_code == 200, on.text
        assert on.json()["data"]["brandCanEditCreative"] is True

        off = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"brandCanEditCreative": False},
            headers=headers,
        )
        assert off.status_code == 200, off.text
        assert off.json()["data"]["brandCanEditCreative"] is False

        got = await app_client.get(f"/api/admin/drops/{drop.id}", headers=headers)
        assert got.status_code == 200
        assert got.json()["data"]["brandCanEditCreative"] is False


class TestBrandPatchCreative:
    async def test_empty_body_noop_when_flag_on(self, app_client: AsyncClient, db_session):
        _, brand, headers = await _brand_ctx(db_session)
        drop = await make_drop(db_session, brand, title="Keep Me")
        flag = await _set_brand_can_edit(app_client, db_session, drop.id, True)
        assert flag.status_code == 200, flag.text

        res = await app_client.patch(_brand_patch_url(drop.id), json={}, headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["title"] == "Keep Me"
        assert data["brandCanEditCreative"] is True

    async def test_unknown_logistics_keys_422(self, app_client: AsyncClient, db_session):
        _, brand, headers = await _brand_ctx(db_session)
        drop = await make_drop(db_session, brand)
        flag = await _set_brand_can_edit(app_client, db_session, drop.id, True)
        assert flag.status_code == 200, flag.text

        loc = await app_client.patch(
            _brand_patch_url(drop.id), json={"location": "Bay Area"}, headers=headers
        )
        assert loc.status_code == 422

        cap = await app_client.patch(
            _brand_patch_url(drop.id), json={"capacityTotal": 99}, headers=headers
        )
        assert cap.status_code == 422

    async def test_explicit_null_title_422(self, app_client: AsyncClient, db_session):
        _, brand, headers = await _brand_ctx(db_session)
        drop = await make_drop(db_session, brand)
        flag = await _set_brand_can_edit(app_client, db_session, drop.id, True)
        assert flag.status_code == 200, flag.text
        res = await app_client.patch(
            _brand_patch_url(drop.id), json={"title": None}, headers=headers
        )
        assert res.status_code == 422

    async def test_flag_off_403_row_unchanged(self, app_client: AsyncClient, db_session):
        _, brand, headers = await _brand_ctx(db_session)
        drop = await make_drop(db_session, brand, title="Original Title")
        original = drop.title

        res = await app_client.patch(
            _brand_patch_url(drop.id),
            json={"title": "Hacked"},
            headers=headers,
        )
        assert res.status_code == 403
        msg = res.json()["error"]["message"]
        assert CREATIVE_FORBIDDEN in msg

        await db_session.refresh(drop)
        assert drop.title == original
        row = (await db_session.scalars(select(Drop).where(Drop.id == drop.id))).one()
        assert row.title == original

    async def test_flag_on_patch_title_and_https_image(self, app_client: AsyncClient, db_session):
        _, brand, headers = await _brand_ctx(db_session)
        drop = await make_drop(db_session, brand, title="Old Title")
        flag = await _set_brand_can_edit(app_client, db_session, drop.id, True)
        assert flag.status_code == 200, flag.text

        res = await app_client.patch(
            _brand_patch_url(drop.id),
            json={"title": "Brand New Title", "image": HTTPS_IMAGE},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        assert res.json()["data"]["title"] == "Brand New Title"
        assert res.json()["data"]["image"] == HTTPS_IMAGE

        got = await app_client.get(_brand_patch_url(drop.id), headers=headers)
        assert got.status_code == 200
        assert got.json()["data"]["title"] == "Brand New Title"
        assert got.json()["data"]["image"] == HTTPS_IMAGE
        assert got.json()["data"]["brandCanEditCreative"] is True

        http = await app_client.patch(
            _brand_patch_url(drop.id),
            json={"image": "http://cdn.example.test/hero.png"},
            headers=headers,
        )
        assert http.status_code == 422

        placeholder = await app_client.patch(
            _brand_patch_url(drop.id),
            json={"image": "https://placehold.co/600x400/png"},
            headers=headers,
        )
        assert placeholder.status_code == 422

    async def test_admin_can_patch_after_brand_edit(self, app_client: AsyncClient, db_session):
        _, brand, brand_headers = await _brand_ctx(db_session)
        drop = await make_drop(db_session, brand, title="Brand Wrote")
        flag = await _set_brand_can_edit(app_client, db_session, drop.id, True)
        assert flag.status_code == 200, flag.text
        brand_ok = await app_client.patch(
            _brand_patch_url(drop.id),
            json={"title": "Brand Wrote", "image": HTTPS_IMAGE},
            headers=brand_headers,
        )
        assert brand_ok.status_code == 200, brand_ok.text

        admin = await _admin_headers(db_session)
        admin_ok = await app_client.patch(
            f"/api/admin/drops/{drop.id}",
            json={"title": "Admin After Brand", "image": HTTPS_IMAGE_2},
            headers=admin,
        )
        assert admin_ok.status_code == 200, admin_ok.text
        assert admin_ok.json()["data"]["title"] == "Admin After Brand"

    async def test_revoke_flag_then_brand_patch_403(self, app_client: AsyncClient, db_session):
        _, brand, headers = await _brand_ctx(db_session)
        drop = await make_drop(db_session, brand, title="Stay")
        on = await _set_brand_can_edit(app_client, db_session, drop.id, True)
        assert on.status_code == 200, on.text
        off = await _set_brand_can_edit(app_client, db_session, drop.id, False)
        assert off.status_code == 200, off.text

        res = await app_client.patch(
            _brand_patch_url(drop.id),
            json={"title": "Should Fail"},
            headers=headers,
        )
        assert res.status_code == 403
        assert CREATIVE_FORBIDDEN in res.json()["error"]["message"]
        await db_session.refresh(drop)
        assert drop.title == "Stay"
