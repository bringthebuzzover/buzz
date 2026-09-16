"""Public drop GET, apply+intent, pending pitch, admin intents (PRODUCT §6.3.4 / §7.1)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

from httpx import AsyncClient
from sqlalchemy import select

from app.models.application import DropApplication
from app.models.drop_apply_intent import DropApplyIntent
from app.models.enums import DropApplyIntentStatus, OrgUserStatus, PortalRole
from app.models.organization import Organization
from app.models.user import User
from app.security import jwt
from app.services.drop_apply_intents import record_drop_apply_intent
from tests.conftest import (
    FakeInstagramClient,
    make_brand,
    make_drop,
    make_org,
    make_user,
    mint_access_token,
    persist,
)

_APPLY = {
    "orgName": "Intent Club",
    "university": "Cornell University",
    "eduEmail": "intent-club@cornell.edu",
    "instagramHandle": "@intentclub",
    "handleConfirmed": True,
    "memberCount": 12,
    "category": "social",
    "contactName": "Sam",
    "shippingLine1": "123 College Ave",
    "shippingCity": "Ithaca",
    "shippingState": "NY",
    "shippingPostalCode": "14850",
}


async def test_stale_bearer_still_returns_public_drop(app_client: AsyncClient, db_session) -> None:
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    resp = await app_client.get(
        f"/api/drops/{drop.id}",
        headers={"Authorization": "Bearer not-a-token"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["title"] == drop.title


async def test_anon_unknown_uuid_is_drop_not_open(app_client: AsyncClient) -> None:
    resp = await app_client.get(f"/api/drops/{uuid.uuid4()}")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "DROP_NOT_OPEN"


async def test_anon_hidden_drop_is_drop_not_open(app_client: AsyncClient, db_session) -> None:
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    drop.hidden_at = datetime.now(timezone.utc)
    await db_session.flush()
    resp = await app_client.get(f"/api/drops/{drop.id}")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "DROP_NOT_OPEN"


async def test_apply_with_drop_id_writes_intent_not_application(
    app_client: AsyncClient, db_session
) -> None:
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    resp = await app_client.post(
        "/api/orgs/apply",
        json={**_APPLY, "dropId": str(drop.id), "pitch": "  We can host  "},
    )
    assert resp.status_code == 200
    org_id = uuid.UUID(resp.json()["data"]["orgId"])
    intent = await db_session.scalar(
        select(DropApplyIntent).where(
            DropApplyIntent.org_id == org_id, DropApplyIntent.drop_id == drop.id
        )
    )
    assert intent is not None
    assert intent.status == DropApplyIntentStatus.OPEN.value
    assert intent.pitch == "We can host"
    assert (
        await db_session.scalar(
            select(DropApplication.id).where(DropApplication.drop_id == drop.id)
        )
        is None
    )


async def test_apply_with_closed_drop_still_creates_expired_intent(
    app_client: AsyncClient, db_session
) -> None:
    brand = await make_brand(db_session)
    now = datetime.now(timezone.utc)
    drop = await make_drop(
        db_session,
        brand,
        apply_open_at=now - timedelta(days=8),
        apply_close_at=now - timedelta(days=1),
    )
    resp = await app_client.post(
        "/api/orgs/apply",
        json={
            **_APPLY,
            "eduEmail": "closed-intent@cornell.edu",
            "instagramHandle": "@closedintent",
            "dropId": str(drop.id),
            "pitch": "late",
        },
    )
    assert resp.status_code == 200
    org_id = uuid.UUID(resp.json()["data"]["orgId"])
    intent = await db_session.scalar(
        select(DropApplyIntent).where(DropApplyIntent.org_id == org_id)
    )
    assert intent is not None
    assert intent.status == DropApplyIntentStatus.EXPIRED.value


async def test_apply_unpublished_drop_id_does_not_create_org(
    app_client: AsyncClient, db_session
) -> None:
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, published_at=None)
    resp = await app_client.post(
        "/api/orgs/apply",
        json={
            **_APPLY,
            "eduEmail": "draft-intent@cornell.edu",
            "instagramHandle": "@draftintent",
            "dropId": str(drop.id),
        },
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "DROP_NOT_OPEN"
    assert (
        await db_session.scalar(
            select(Organization.id).where(Organization.org_name == "Intent Club")
        )
        is None
    )


async def test_pending_org_sees_intent_and_can_patch_pitch(
    app_client: AsyncClient, db_session
) -> None:
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    user = await persist(
        db_session,
        make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_APPROVAL),
    )
    org = await make_org(db_session, user)
    await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop.id, pitch="v1")
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    got = await app_client.get(f"/api/drops/{drop.id}", headers=headers)
    assert got.status_code == 200
    assert got.json()["data"]["intentStatus"] == "open"
    assert got.json()["data"]["intentPitch"] == "v1"
    assert got.json()["data"]["alreadyApplied"] is False

    patched = await app_client.patch(
        f"/api/drops/{drop.id}/intent", headers=headers, json={"pitch": "v2"}
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["intentPitch"] == "v2"


async def test_admin_drop_lists_intents_separate_from_applicants(
    app_client: AsyncClient, db_session
) -> None:
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    user = await persist(
        db_session,
        make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_APPROVAL),
    )
    org = await make_org(db_session, user, org_name="Intent Org")
    await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop.id, pitch="hello")
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    res = await app_client.get(
        f"/api/admin/drops/{drop.id}",
        headers={"Authorization": f"Bearer {mint_access_token(admin)}"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["applicants"] == []
    assert len(data["intents"]) == 1
    assert data["intents"][0]["orgName"] == "Intent Org"
    assert data["intents"][0]["status"] == "open"
    assert data["intents"][0]["pitch"] == "hello"


async def test_brand_drop_detail_omits_intents(app_client: AsyncClient, db_session) -> None:
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    brand_user = await db_session.get(User, brand.user_id)
    assert brand_user is not None
    res = await app_client.get(
        f"/api/brands/me/drops/{drop.id}",
        headers={"Authorization": f"Bearer {mint_access_token(brand_user)}"},
    )
    assert res.status_code == 200
    assert "intents" not in res.json()["data"]


async def test_login_state_carries_allowlisted_next(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient
) -> None:
    drop_id = uuid.uuid4()
    resp = await app_client.get(
        "/api/auth/instagram/login",
        params={"next": f"/d/{drop_id}"},
        follow_redirects=False,
    )
    assert resp.status_code == 302
    state = parse_qs(urlparse(resp.headers["location"]).query)["state"][0]
    payload = jwt.decode_token(state, expected_type=jwt.OAUTH_STATE_TOKEN_TYPE)
    assert payload.next == f"/d/{drop_id}"
