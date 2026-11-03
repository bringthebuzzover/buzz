"""Admin-reviewed organization shipping address changes."""

from __future__ import annotations

import asyncio

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, event
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.brand import Brand
from app.models.drop import Drop
from app.models.enums import ApplicationDecision, PortalRole
from app.models.org_shipping_change_request import OrgShippingChangeRequest
from app.models.organization import Organization
from app.models.shipment import DropApplicationShipment
from app.models.user import User
from app.services.address import FormatFallbackAddressClient
from app.services.admin_erase import erase_org_user
from app.services.shipping_change_requests import approve_request, submit_request
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


async def _pending_request(db_session, user):
    return await submit_request(
        db_session,
        user,
        shipping_line1="9 New St",
        shipping_line2=None,
        shipping_city="Berkeley",
        shipping_state="CA",
        shipping_postal_code="94704",
        shipping_place_id=None,
        reason="Our campus mailroom moved.",
        addresses=FormatFallbackAddressClient(),
    )


async def test_denial_preserves_address_and_notifies_org(app_client: AsyncClient, db_session):
    user, org = await _active_org(db_session)
    pending = await _pending_request(db_session, user)
    result = await app_client.post(
        f"/api/admin/shipping-change-requests/{pending['id']}/deny",
        headers=await admin_headers(db_session),
        json={"decisionReason": "Please confirm the mailroom."},
    )
    assert result.status_code == 200, result.text
    denied = result.json()["data"]
    assert denied["status"] == "denied"
    assert denied["decidedAt"] is not None
    assert denied["reviewerUserId"] is not None
    state = await app_client.get(
        "/api/orgs/me/shipping-change-request",
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert state.status_code == 200
    assert state.json()["data"]["pending"] is None
    assert state.json()["data"]["latest"]["decisionReason"] == "Please confirm the mailroom."
    assert state.json()["data"]["latest"]["status"] == "denied"
    await db_session.refresh(org)
    assert org.shipping_line1 == "1 Main St"
    assert org.shipping_address_version == 0


@pytest.mark.parametrize("role", [PortalRole.ORG, PortalRole.BRAND])
@pytest.mark.parametrize("action", ["list", "read", "approve", "deny"])
async def test_non_admin_cannot_read_or_decide_shipping_requests(
    app_client: AsyncClient, db_session, role, action
):
    owner, _ = await _active_org(db_session)
    pending = await _pending_request(db_session, owner)
    visitor = await persist(db_session, make_user(role=role))
    if role == PortalRole.ORG:
        await make_org(db_session, visitor)
    headers = {"Authorization": f"Bearer {mint_access_token(visitor)}"}
    url = "/api/admin/shipping-change-requests"
    if action != "list":
        url += f"/{pending['id']}"
    if action in {"approve", "deny"}:
        response = await app_client.post(f"{url}/{action}", headers=headers, json={})
    else:
        response = await app_client.get(url, headers=headers)
    assert response.status_code == 403, response.text
    row = await db_session.get(OrgShippingChangeRequest, pending["id"])
    assert row.status == "pending"
    if role == PortalRole.ORG:
        state = await app_client.get("/api/orgs/me/shipping-change-request", headers=headers)
        assert state.status_code == 200
        assert state.json()["data"] == {"pending": None, "latest": None}


async def test_erase_redacts_pending_shipping_request(app_client: AsyncClient, db_session):
    user, org = await _active_org(db_session)
    user.edu_email = None
    pending = await _pending_request(db_session, user)
    response = await app_client.post(
        f"/api/admin/orgs/{user.id}/erase",
        headers=await admin_headers(db_session),
        json={"confirm": user.instagram_username},
    )
    assert response.status_code == 200, response.text
    row = await db_session.get(OrgShippingChangeRequest, pending["id"])
    await db_session.refresh(row)
    assert row.status == "denied"
    assert row.decided_at is not None
    assert row.redacted_at is not None
    assert row.current_address is None
    assert row.requested_address is None
    assert row.reason is None
    assert row.decision_reason is None
    await db_session.refresh(org)
    assert org.shipping_line1 is None


@pytest.mark.parametrize(
    ("first_action", "second_action"),
    [("approve", "approve"), ("approve", "erase"), ("erase", "approve")],
)
async def test_shipping_review_and_erase_serialize(
    engine, monkeypatch, first_action, second_action
):
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as setup:
        user, org = await _active_org(setup)
        user.edu_email = None
        reviewer = await persist(setup, make_user(role=PortalRole.ADMIN))
        pending = await _pending_request(setup, user)
        brand = await make_brand(setup)
        drop = await make_drop(setup, brand)
        seat = await make_application(setup, drop, org, decision=ApplicationDecision.ACCEPTED)
        shipment = await persist(
            setup,
            DropApplicationShipment(
                application_id=seat.id,
                tracking_number="1ZTEST",
                carrier="ups",
                shipping_address_snapshot={"formatted": "1 Test St"},
            ),
        )
        await setup.commit()

    # Hold the erasure transaction until the competing request reaches its org lock.
    async def defer_commit(db):
        await db.flush()

    monkeypatch.setattr("app.services.admin_erase.commit_revocation", defer_commit)
    async with factory() as first, factory() as second:
        # Cache the pending row to exercise refresh after waiting on the org.
        cached_request = await second.get(OrgShippingChangeRequest, pending["id"])
        assert cached_request.status == "pending"
        waiting = asyncio.Event()
        lock_tables = []

        def record_locks(conn, cursor, statement, parameters, context, executemany):
            if "FOR UPDATE" in statement and "FROM organizations" in statement:
                lock_tables.append("organizations")
                waiting.set()
            elif "FOR UPDATE" in statement and "FROM org_shipping_change_requests" in statement:
                lock_tables.append("requests")
            elif statement.startswith("UPDATE drop_application_shipments"):
                lock_tables.append("shipments")

        async def act(db, action):
            if action == "approve":
                return await approve_request(
                    db, pending["id"], reviewer, addresses=FormatFallbackAddressClient()
                )
            return await erase_org_user(db, user.id, user.instagram_username)

        loser = None
        try:
            event.listen(engine.sync_engine, "before_cursor_execute", record_locks)
            await act(first, first_action)
            assert lock_tables[:2] == ["organizations", "requests"]
            if first_action == "erase":
                assert lock_tables == ["organizations", "requests", "shipments"]
            lock_tables.clear()
            waiting.clear()
            loser = asyncio.create_task(act(second, second_action))
            await asyncio.wait_for(waiting.wait(), timeout=5)
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(asyncio.shield(loser), timeout=0.1)
            assert lock_tables == ["organizations"]
            await first.commit()
            if second_action == "approve":
                with pytest.raises(BuzzAPIException) as error:
                    await asyncio.wait_for(loser, timeout=5)
                assert error.value.status_code == 409
                await second.rollback()
            else:
                await asyncio.wait_for(loser, timeout=5)
                await second.commit()
                assert lock_tables == ["organizations", "requests", "shipments"]
            async with factory() as verify:
                row = await verify.get(OrgShippingChangeRequest, pending["id"])
                profile = await verify.get(Organization, org.id)
                if "erase" in {first_action, second_action}:
                    assert row.redacted_at is not None
                    assert row.current_address is None
                    assert row.requested_address is None
                    assert profile.shipping_line1 is None
                    package = await verify.get(DropApplicationShipment, shipment.id)
                    assert package.shipping_address_snapshot is None
                else:
                    assert row.status == "approved"
                    assert profile.shipping_line1 == "9 New St"
                    assert profile.shipping_address_version == 1
        finally:
            event.remove(engine.sync_engine, "before_cursor_execute", record_locks)
            if loser is not None and not loser.done():
                loser.cancel()
                await asyncio.gather(loser, return_exceptions=True)
            await first.rollback()
            await second.rollback()
            async with factory() as cleanup:
                await cleanup.execute(delete(DropApplication).where(DropApplication.id == seat.id))
                await cleanup.execute(delete(Drop).where(Drop.id == drop.id))
                await cleanup.execute(delete(Brand).where(Brand.id == brand.id))
                await cleanup.execute(delete(Organization).where(Organization.id == org.id))
                await cleanup.execute(
                    delete(User).where(User.id.in_([user.id, reviewer.id, brand.user_id]))
                )
                await cleanup.commit()
