"""Tests for ``/api/orgs/me`` (Stage 5A)."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import select

from app.models.enums import OrgUserStatus, PortalRole
from app.models.organization import Organization
from app.models.user import User
from tests.conftest import make_org, make_user, mint_access_token, persist


async def _org_headers(db_session) -> tuple[dict[str, str], Organization, User]:
    user = await persist(db_session, make_user())
    user.edu_email = "org@test.edu"
    org = await make_org(db_session, user, org_name="Berkeley Rowing")
    return {"Authorization": f"Bearer {mint_access_token(user)}"}, org, user


async def test_get_me_returns_profile(app_client: AsyncClient, db_session) -> None:
    headers, org, _user = await _org_headers(db_session)
    resp = await app_client.get("/api/orgs/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == str(org.id)
    assert data["orgName"] == "Berkeley Rowing"
    assert data["eduEmail"] == "org@test.edu"
    # camelCase + nullable fields present
    assert "followerCount" in data and "tiktokHandle" in data


async def test_get_me_404_when_no_profile(app_client: AsyncClient, db_session) -> None:
    user = await persist(db_session, make_user())  # active org, no organizations row
    resp = await app_client.get(
        "/api/orgs/me", headers={"Authorization": f"Bearer {mint_access_token(user)}"}
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_patch_me_updates_field(app_client: AsyncClient, db_session) -> None:
    headers, org, _user = await _org_headers(db_session)
    resp = await app_client.patch(
        "/api/orgs/me",
        headers=headers,
        json={"orgName": "New Name", "memberCount": 55},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["orgName"] == "New Name"
    assert data["memberCount"] == 55


async def test_patch_me_rejects_follower_count(app_client: AsyncClient, db_session) -> None:
    headers, org, _user = await _org_headers(db_session)
    prior = org.follower_count
    resp = await app_client.patch(
        "/api/orgs/me",
        headers=headers,
        json={"followerCount": 1200},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    await db_session.refresh(org)
    assert org.follower_count == prior


async def test_patch_me_rejects_unknown_field(app_client: AsyncClient, db_session) -> None:
    headers, org, user = await _org_headers(db_session)
    # edu_email is not editable; unknown/typo keys are forbidden (not silently
    # ignored) so they can't masquerade as a no-op write.
    resp = await app_client.patch("/api/orgs/me", headers=headers, json={"eduEmail": "evil@x.edu"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    await db_session.refresh(user)
    assert user.edu_email == "org@test.edu"


async def test_patch_me_empty_body_noop(app_client: AsyncClient, db_session) -> None:
    headers, _org, _user = await _org_headers(db_session)
    resp = await app_client.patch("/api/orgs/me", headers=headers, json={})
    assert resp.status_code == 200
    assert resp.json()["data"]["orgName"] == "Berkeley Rowing"


async def test_patch_me_validation_error(app_client: AsyncClient, db_session) -> None:
    headers, _org, _user = await _org_headers(db_session)
    resp = await app_client.patch("/api/orgs/me", headers=headers, json={"memberCount": -5})
    assert resp.status_code == 422
    body = resp.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    # The envelope carries the raw validation errors under details.errors.
    assert isinstance(body["error"]["details"]["errors"], list)


async def test_patch_me_clears_leftover_campus_city(app_client: AsyncClient, db_session) -> None:
    headers, org, _user = await _org_headers(db_session)
    org.city = "Ithaca"
    await db_session.flush()
    resp = await app_client.patch("/api/orgs/me", headers=headers, json={"city": None})
    assert resp.status_code == 200
    await db_session.refresh(org)
    assert org.city is None


async def test_patch_me_rejects_instagram_handle(app_client: AsyncClient, db_session) -> None:
    headers, org, user = await _org_headers(db_session)
    # Handle mirrors OAuth username — not editable via PATCH.
    resp = await app_client.patch(
        "/api/orgs/me", headers=headers, json={"instagramHandle": "evilorg"}
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    await db_session.refresh(user)
    assert user.instagram_username == "testorg"


async def test_patch_me_null_required_field_rejected(app_client: AsyncClient, db_session) -> None:
    headers, org, _user = await _org_headers(db_session)
    # org_name is NOT NULL — explicit null must 422, not flush a 500.
    resp = await app_client.patch("/api/orgs/me", headers=headers, json={"orgName": None})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    refreshed = await db_session.scalar(select(Organization).where(Organization.id == org.id))
    assert refreshed.org_name == "Berkeley Rowing"


async def test_get_me_requires_auth(app_client: AsyncClient, db_session) -> None:
    resp = await app_client.get("/api/orgs/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_get_me_forbidden_for_brand(app_client: AsyncClient, db_session) -> None:
    brand_user = await persist(
        db_session, make_user(role=PortalRole.BRAND, status=OrgUserStatus.ACTIVE)
    )
    resp = await app_client.get(
        "/api/orgs/me",
        headers={"Authorization": f"Bearer {mint_access_token(brand_user)}"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_get_me_includes_shipping_fields(app_client: AsyncClient, db_session) -> None:
    headers, org, _user = await _org_headers(db_session)
    org.shipping_line1 = "123 College Ave"
    org.shipping_city = "Ithaca"
    org.shipping_state = "NY"
    org.shipping_postal_code = "14850"
    org.delivery_address = "123 College Ave, Ithaca, NY 14850"
    await db_session.flush()
    resp = await app_client.get("/api/orgs/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["shippingLine1"] == "123 College Ave"
    assert data["shippingPostalCode"] == "14850"
    assert data["deliveryAddress"] == "123 College Ave, Ithaca, NY 14850"


async def test_patch_me_omitting_shipping_leaves_legacy_blob(
    app_client: AsyncClient, db_session
) -> None:
    headers, org, _user = await _org_headers(db_session)
    org.delivery_address = "legacy blob"
    await db_session.flush()
    resp = await app_client.patch(
        "/api/orgs/me",
        headers=headers,
        json={"orgName": "Still Legacy"},
    )
    assert resp.status_code == 200
    await db_session.refresh(org)
    assert org.org_name == "Still Legacy"
    assert org.delivery_address == "legacy blob"
    assert org.shipping_line1 is None


async def test_patch_me_rejects_garbage_shipping(app_client: AsyncClient, db_session) -> None:
    headers, org, _user = await _org_headers(db_session)
    org.delivery_address = "legacy blob"
    await db_session.flush()
    resp = await app_client.patch(
        "/api/orgs/me",
        headers=headers,
        json={
            "shippingLine1": "asdf",
            "shippingCity": "Ithaca",
            "shippingState": "NY",
            "shippingPostalCode": "14850",
        },
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_SHIPPING_ADDRESS"
    await db_session.refresh(org)
    assert org.delivery_address == "legacy blob"


async def test_patch_me_validates_structured_shipping(app_client: AsyncClient, db_session) -> None:
    headers, org, _user = await _org_headers(db_session)
    resp = await app_client.patch(
        "/api/orgs/me",
        headers=headers,
        json={
            "shippingLine1": "PO Box 123",
            "shippingLine2": "CPO 400",
            "shippingCity": "Ithaca",
            "shippingState": "ny",
            "shippingPostalCode": "14850",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["shippingLine1"] == "PO Box 123"
    assert data["shippingLine2"] == "CPO 400"
    assert data["shippingState"] == "NY"
    assert data["deliveryAddress"] == "PO Box 123, CPO 400, Ithaca, NY 14850"
    await db_session.refresh(org)
    assert org.shipping_postal_code == "14850"


async def test_patch_me_rejects_writable_delivery_address(
    app_client: AsyncClient, db_session
) -> None:
    headers, _org, _user = await _org_headers(db_session)
    resp = await app_client.patch(
        "/api/orgs/me",
        headers=headers,
        json={"deliveryAddress": "asdf"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
