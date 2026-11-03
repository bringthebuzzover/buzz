"""Admin-reviewed organization shipping address changes."""

from __future__ import annotations

from httpx import AsyncClient

from app.models.enums import PortalRole
from tests.conftest import admin_headers, make_org, make_user, mint_access_token, persist


def _address(line1: str = "123 College Ave") -> dict[str, str]:
    return {
        "shippingLine1": line1,
        "shippingLine2": "Suite 4",
        "shippingCity": "Berkeley",
        "shippingState": "CA",
        "shippingPostalCode": "94704",
    }


async def _active_org(db_session):
    user = await persist(db_session, make_user(role=PortalRole.ORG))
    user.edu_email = "org@test.edu"
    org = await make_org(db_session, user, org_name="Berkeley Rowing")
    org.shipping_line1 = "1 Main St"
    org.shipping_line2 = None
    org.shipping_city = "Berkeley"
    org.shipping_state = "CA"
    org.shipping_postal_code = "94704"
    org.delivery_address = "1 Main St, Berkeley, CA 94704"
    return user, org


async def test_org_address_replacement_requires_admin_and_approval_updates_current_address(
    app_client: AsyncClient, db_session
):
    user, org = await _active_org(db_session)
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}

    direct = await app_client.patch(
        "/api/orgs/me",
        headers=headers,
        json={**_address("9 New St"), "shippingPlaceId": None},
    )
    assert direct.status_code == 409
    assert direct.json()["error"]["code"] == "ADDRESS_CHANGE_REVIEW_REQUIRED"

    created = await app_client.post(
        "/api/orgs/me/shipping-change-requests",
        headers=headers,
        json={**_address("9 New St"), "reason": "Our campus mailroom moved."},
    )
    assert created.status_code == 201, created.text
    request_id = created.json()["data"]["id"]
    state = await app_client.get("/api/orgs/me/shipping-change-request", headers=headers)
    assert state.status_code == 200
    assert state.json()["data"]["pending"]["id"] == request_id

    blocked = await app_client.post(
        "/api/orgs/me/shipping-change-requests",
        headers=headers,
        json={**_address("11 Other St"), "reason": "Another change request."},
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "ADDRESS_CHANGE_PENDING"

    admin = await admin_headers(db_session)
    listed = await app_client.get(
        "/api/admin/shipping-change-requests?status=pending", headers=admin
    )
    assert listed.status_code == 200
    assert listed.json()["data"][0]["orgName"] == "Berkeley Rowing"
    approved = await app_client.post(
        f"/api/admin/shipping-change-requests/{request_id}/approve", headers=admin
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["data"]["status"] == "approved"
    await db_session.refresh(org)
    assert org.shipping_line1 == "9 New St"
    assert org.shipping_address_version == 1


async def test_stale_shipping_request_cannot_overwrite_a_newer_address(
    app_client: AsyncClient, db_session
):
    user, org = await _active_org(db_session)
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    created = await app_client.post(
        "/api/orgs/me/shipping-change-requests",
        headers=headers,
        json={**_address("9 New St"), "reason": "Our campus mailroom moved."},
    )
    request_id = created.json()["data"]["id"]
    org.shipping_line1 = "3 Newer St"
    org.shipping_address_version += 1
    await db_session.flush()

    approved = await app_client.post(
        f"/api/admin/shipping-change-requests/{request_id}/approve",
        headers=await admin_headers(db_session),
    )
    assert approved.status_code == 409
    assert approved.json()["error"]["code"] == "ADDRESS_CHANGE_STALE"
    await db_session.refresh(org)
    assert org.shipping_line1 == "3 Newer St"
