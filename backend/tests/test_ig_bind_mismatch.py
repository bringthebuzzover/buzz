"""Connect bind vs claimed handle — admin mismatch flag (PRODUCT §3.1)."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

from httpx import AsyncClient
from sqlalchemy import select

from app import errors
from app.models.enums import OrgUserStatus, PortalRole
from app.models.organization import Organization
from app.models.user import User
from app.security.token_crypto import encrypt_token
from tests.conftest import (
    FakeInstagramClient,
    make_org,
    make_user,
    mint_access_token,
    persist,
)


async def _admin_headers(db_session) -> dict:
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


async def _pending_connect(db_session, *, claimed: str, username: str | None = None):
    user = await persist(
        db_session,
        make_user(
            role=PortalRole.ORG,
            status=OrgUserStatus.PENDING_INSTAGRAM,
            instagram_user_id=None,
            instagram_username=username or claimed,
        ),
    )
    org = await make_org(db_session, user)
    org.claimed_instagram_username = claimed
    await db_session.flush()
    return user, org


async def _bind(app_client: AsyncClient, user: User, fake: FakeInstagramClient) -> None:
    token = mint_access_token(user)
    start = await app_client.post(
        "/api/auth/instagram/bind-start",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert start.status_code == 200, start.text
    state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "bind-code", "state": state},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["user"]["status"] == "active"


async def test_apply_writes_claimed(app_client: AsyncClient, db_session) -> None:
    from tests.test_org_apply import _APPLY

    resp = await app_client.post(
        "/api/orgs/apply",
        json={**_APPLY, "eduEmail": "claimed@cornell.edu"},
    )
    assert resp.status_code == 200, resp.text
    org = await db_session.scalar(
        select(Organization)
        .join(User, User.id == Organization.user_id)
        .where(User.edu_email == "claimed@cornell.edu")
    )
    assert org is not None
    assert org.claimed_instagram_username == "campusgreeks"
    assert org.ig_bind_mismatched_at is None


async def test_bind_mismatch_flags_and_stays_active(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_mismatch_1"
    fake_instagram.username = "otherclub"
    user, org = await _pending_connect(db_session, claimed="campusgreeks")
    await _bind(app_client, user, fake_instagram)
    await db_session.refresh(user)
    await db_session.refresh(org)
    assert user.status == OrgUserStatus.ACTIVE.value
    assert user.instagram_username == "otherclub"
    assert org.claimed_instagram_username == "campusgreeks"
    assert org.ig_bind_graph_username == "otherclub"
    assert org.ig_bind_mismatched_at is not None
    assert org.ig_bind_mismatch_acked_at is None

    admin = await _admin_headers(db_session)
    overview = await app_client.get("/api/admin/overview", headers=admin)
    data = overview.json()["data"]
    mismatch_q = next(q for q in data["queues"] if q["key"] == "orgs_ig_bind_mismatch")
    assert mismatch_q["count"] == 1
    kinds = [item["kind"] for item in data["items"]]
    assert "ig_bind_mismatch" in kinds
    item = next(i for i in data["items"] if i["kind"] == "ig_bind_mismatch")
    assert item["href"] == f"/admin/orgs/{user.id}"
    assert "campusgreeks" in item["subtitle"]
    assert "otherclub" in item["subtitle"]

    listed = await app_client.get("/api/admin/orgs?attention=ig_bind_mismatch", headers=admin)
    assert listed.status_code == 200
    assert any(row["userId"] == str(user.id) for row in listed.json()["data"])

    ack = await app_client.post(f"/api/admin/orgs/{org.id}/ig-bind-mismatch/ack", headers=admin)
    assert ack.status_code == 200, ack.text
    await db_session.refresh(org)
    assert org.ig_bind_mismatch_acked_at is not None
    assert org.ig_bind_mismatched_at is not None

    overview2 = await app_client.get("/api/admin/overview", headers=admin)
    mismatch_q2 = next(
        q for q in overview2.json()["data"]["queues"] if q["key"] == "orgs_ig_bind_mismatch"
    )
    assert mismatch_q2["count"] == 0
    assert overview2.json()["data"]["items"] == []

    again = await app_client.post(f"/api/admin/orgs/{org.id}/ig-bind-mismatch/ack", headers=admin)
    assert again.status_code == 400


async def test_bind_matching_handle_does_not_flag(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_match_1"
    fake_instagram.username = "CampusGreeks"
    user, org = await _pending_connect(db_session, claimed="campusgreeks")
    await _bind(app_client, user, fake_instagram)
    await db_session.refresh(org)
    assert org.ig_bind_mismatched_at is None
    assert org.claimed_instagram_username == "campusgreeks"


async def test_returning_login_does_not_flag(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_return_1"
    fake_instagram.username = "renamedclub"
    user = await persist(
        db_session,
        make_user(
            role=PortalRole.ORG,
            instagram_user_id="ig_return_1",
            instagram_username="oldclub",
        ),
    )
    org = await make_org(db_session, user)
    org.claimed_instagram_username = "oldclub"
    await db_session.flush()

    login = await app_client.get("/api/auth/instagram/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "login-code", "state": state},
    )
    assert resp.status_code == 200, resp.text
    await db_session.refresh(org)
    await db_session.refresh(user)
    assert user.instagram_username == "renamedclub"
    assert org.ig_bind_mismatched_at is None


async def test_empty_claimed_does_not_flag(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_empty_claimed"
    fake_instagram.username = "somethingelse"
    user, org = await _pending_connect(db_session, claimed="campusgreeks")
    org.claimed_instagram_username = None
    await db_session.flush()
    await _bind(app_client, user, fake_instagram)
    await db_session.refresh(org)
    assert org.ig_bind_mismatched_at is None


async def test_unknown_attention_rejected(app_client: AsyncClient, db_session) -> None:
    admin = await _admin_headers(db_session)
    res = await app_client.get("/api/admin/orgs?attention=bogus", headers=admin)
    assert res.status_code == 400


async def test_switch_clears_mismatch_then_rebind_can_flag(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session, monkeypatch
) -> None:
    from unittest.mock import AsyncMock

    monkeypatch.setattr(
        "app.services.ig_change_requests.send_org_ig_switch_connect_email",
        AsyncMock(return_value=True),
    )
    user = await persist(
        db_session,
        make_user(
            role=PortalRole.ORG,
            instagram_user_id="ig_switch_a",
            instagram_username="oldclub",
        ),
    )
    user.instagram_token_user_id = "ig_switch_a"
    user.instagram_access_token = encrypt_token("tok-a")
    user.edu_email = "officer@school.edu"
    org = await make_org(db_session, user)
    org.claimed_instagram_username = "oldclub"
    org.ig_bind_mismatched_at = org.created_at
    org.ig_bind_graph_username = "wrongclub"
    await db_session.flush()

    org_headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    created = await app_client.post(
        "/api/orgs/me/ig-change-requests",
        json={
            "requestedHandle": "newcampusig",
            "reason": "We lost access to the old club account.",
        },
        headers=org_headers,
    )
    assert created.status_code == 200, created.text
    admin = await _admin_headers(db_session)
    approved = await app_client.post(
        f"/api/admin/ig-change-requests/{created.json()['data']['id']}/approve",
        json={"kind": "account_switch", "testerInviteConfirmed": True},
        headers=admin,
    )
    assert approved.status_code == 200, approved.text
    await db_session.refresh(org)
    await db_session.refresh(user)
    assert org.claimed_instagram_username == "newcampusig"
    assert org.ig_bind_mismatched_at is None

    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_switch_b"
    fake_instagram.username = "thirdclub"
    await _bind(app_client, user, fake_instagram)
    await db_session.refresh(org)
    assert org.ig_bind_graph_username == "thirdclub"
    assert org.ig_bind_mismatched_at is not None
    assert org.ig_bind_mismatch_acked_at is None


async def test_bind_taken_handle_409_does_not_flag(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    peer = await persist(
        db_session,
        make_user(
            role=PortalRole.ORG,
            status=OrgUserStatus.ACTIVE,
            instagram_username="takenclub",
        ),
    )
    await make_org(db_session, peer, org_name="Peer Org")
    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_taken_bind"
    fake_instagram.username = "takenclub"
    user, org = await _pending_connect(db_session, claimed="campusgreeks")
    token = mint_access_token(user)
    start = await app_client.post(
        "/api/auth/instagram/bind-start",
        headers={"Authorization": f"Bearer {token}"},
    )
    state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "bind-taken", "state": state},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == errors.INSTAGRAM_HANDLE_TAKEN
    await db_session.refresh(org)
    await db_session.refresh(user)
    assert org.ig_bind_mismatched_at is None
    assert user.status == OrgUserStatus.PENDING_INSTAGRAM.value
    assert user.instagram_username == "campusgreeks"


async def test_matching_bind_leaves_existing_mismatch(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_keep_flag"
    fake_instagram.username = "campusgreeks"
    user, org = await _pending_connect(db_session, claimed="campusgreeks")
    org.ig_bind_mismatched_at = org.created_at
    org.ig_bind_graph_username = "oldwrong"
    await db_session.flush()
    await _bind(app_client, user, fake_instagram)
    await db_session.refresh(org)
    assert org.ig_bind_mismatched_at is not None
    assert org.ig_bind_graph_username == "oldwrong"
    assert org.ig_bind_mismatch_acked_at is None
