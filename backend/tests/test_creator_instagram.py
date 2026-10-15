"""Creator Instagram bind. Org unknown-login still does not insert a user."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

from httpx import AsyncClient
from sqlalchemy import func, select

from app.models.creator import Creator
from app.models.enums import CreatorStatus, OrgUserStatus, PortalRole
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.security.one_shot_tokens import hash_token
from app.security.token_crypto import decrypt_token
from tests.conftest import FakeInstagramClient, make_user, mint_access_token, persist

_APPLY = {
    "name": "Ada Lovelace",
    "school": "Cornell",
    "city": "Ithaca",
    "gradYear": "2027",
    "eduEmail": "bind@cornell.edu",
    "claimedHandle": "ada.creates",
    "niches": ["photo"],
    "bio": "Campus photo essays.",
    "openTo": ["Flat fee"],
}


async def _pending_instagram(app_client: AsyncClient, db_session, email: str) -> Creator:
    res = await app_client.post(
        "/api/creators/apply",
        json={**_APPLY, "eduEmail": email},
    )
    assert res.status_code == 200, res.text
    creator = await db_session.get(Creator, res.json()["data"]["creatorId"])
    assert creator is not None
    token_row = await db_session.scalar(
        select(EmailVerificationToken).where(EmailVerificationToken.user_id == creator.user_id)
    )
    assert token_row is not None
    raw = f"tok-{email}"
    token_row.token_hash = hash_token(raw)
    await db_session.flush()
    assert (
        await app_client.post("/api/creators/verify-email", json={"token": raw})
    ).status_code == 200
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    approved = await app_client.post(
        f"/api/admin/creators/{creator.id}/approve",
        headers={"Authorization": f"Bearer {mint_access_token(admin)}"},
    )
    assert approved.status_code == 200, approved.text
    await db_session.refresh(creator)
    return creator


async def _bind(
    app_client: AsyncClient,
    user: User,
    *,
    next_path: str | None = "/creators/feed",
) -> object:
    start = await app_client.post(
        "/api/auth/instagram/bind-start",
        params={"next": next_path} if next_path else None,
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    return start


class TestCreatorInstagram:
    async def test_bind_from_pending_instagram_becomes_active(
        self, app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
    ):
        fake_instagram.user_id = "ig_creator_bind"
        fake_instagram.username = "graphname"
        creator = await _pending_instagram(app_client, db_session, "bind-ok@cornell.edu")
        user = await db_session.get(User, creator.user_id)
        assert user is not None
        start = await _bind(app_client, user)
        assert start.status_code == 200, start.text
        state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
        resp = await app_client.post(
            "/api/auth/instagram/callback",
            json={"code": "bind-code", "state": state},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()["data"]
        assert body["next"] == "/creators/feed"
        assert body["user"]["portal_role"] == "creator"
        await db_session.refresh(creator)
        await db_session.refresh(user)
        assert creator.status == CreatorStatus.ACTIVE.value
        assert creator.claimed_instagram_username == "ada.creates"
        assert user.instagram_username == "graphname"
        assert user.instagram_user_id == "ig_creator_bind"
        assert user.status == OrgUserStatus.ACTIVE.value

    async def test_bind_from_other_status_fails(
        self, app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
    ):
        res = await app_client.post(
            "/api/creators/apply",
            json={**_APPLY, "eduEmail": "early@cornell.edu"},
        )
        creator = await db_session.get(Creator, res.json()["data"]["creatorId"])
        assert creator is not None
        user = await db_session.get(User, creator.user_id)
        assert user is not None
        start = await _bind(app_client, user)
        assert start.status_code == 400
        assert start.json()["error"]["code"] == "INVALID_ONBOARDING_STATE"

    async def test_personal_account_fails(
        self, app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
    ):
        fake_instagram.account_type = "PERSONAL"
        fake_instagram.user_id = "ig_personal"
        creator = await _pending_instagram(app_client, db_session, "personal@cornell.edu")
        user = await db_session.get(User, creator.user_id)
        assert user is not None
        start = await _bind(app_client, user)
        state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
        resp = await app_client.post(
            "/api/auth/instagram/callback",
            json={"code": "c", "state": state},
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "INSTAGRAM_PERSONAL_ACCOUNT"
        await db_session.refresh(creator)
        assert creator.status == CreatorStatus.PENDING_INSTAGRAM.value

    async def test_instagram_already_on_org_fails(
        self, app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
    ):
        fake_instagram.user_id = "ig_taken_org"
        await persist(
            db_session,
            make_user(role=PortalRole.ORG, instagram_user_id="ig_taken_org"),
        )
        creator = await _pending_instagram(app_client, db_session, "taken@cornell.edu")
        user = await db_session.get(User, creator.user_id)
        assert user is not None
        start = await _bind(app_client, user)
        state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
        resp = await app_client.post(
            "/api/auth/instagram/callback",
            json={"code": "c", "state": state},
        )
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "INSTAGRAM_HANDLE_TAKEN"

    async def test_second_login_refreshes_token_without_a_new_row(
        self, app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
    ):
        fake_instagram.user_id = "ig_return"
        fake_instagram.username = "returner"
        creator = await _pending_instagram(app_client, db_session, "return@cornell.edu")
        user = await db_session.get(User, creator.user_id)
        assert user is not None
        start = await _bind(app_client, user)
        state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
        first = await app_client.post(
            "/api/auth/instagram/callback",
            json={"code": "first", "state": state},
        )
        assert first.status_code == 200, first.text
        creator_users = (
            select(func.count())
            .select_from(User)
            .where(User.portal_role == PortalRole.CREATOR.value)
        )
        before = await db_session.scalar(creator_users)
        fake_instagram.long_lived_token = "second-long-lived"
        login = await app_client.get("/api/auth/instagram/login", follow_redirects=False)
        state2 = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
        second = await app_client.post(
            "/api/auth/instagram/callback",
            json={"code": "second", "state": state2},
        )
        assert second.status_code == 200, second.text
        after = await db_session.scalar(creator_users)
        assert after == before
        await db_session.refresh(user)
        assert decrypt_token(user.instagram_access_token or "") == "second-long-lived"

    async def test_logout_bumps_only_the_creator(
        self, app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
    ):
        fake_instagram.user_id = "ig_logout"
        creator = await _pending_instagram(app_client, db_session, "logout@cornell.edu")
        user = await db_session.get(User, creator.user_id)
        assert user is not None
        org = await persist(db_session, make_user(role=PortalRole.ORG))
        org_version = org.token_version
        start = await _bind(app_client, user)
        state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
        signed = await app_client.post(
            "/api/auth/instagram/callback",
            json={"code": "c", "state": state},
        )
        access = signed.json()["data"]["access_token"]
        await db_session.refresh(user)
        signed_in_version = user.token_version
        out = await app_client.post(
            "/api/auth/logout",
            headers={"Authorization": f"Bearer {access}"},
        )
        assert out.status_code == 200
        await db_session.refresh(user)
        await db_session.refresh(org)
        assert user.token_version == signed_in_version + 1
        assert org.token_version == org_version

    async def test_unknown_instagram_does_not_insert_a_creator(
        self, app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
    ):
        fake_instagram.user_id = "ig_unknown_creator"
        fake_instagram.account_type = "BUSINESS"
        login = await app_client.get("/api/auth/instagram/login", follow_redirects=False)
        state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
        resp = await app_client.post(
            "/api/auth/instagram/callback",
            json={"code": "c", "state": state},
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "ORG_APPLY_REQUIRED"
        count = await db_session.scalar(select(func.count()).select_from(Creator))
        assert count == 0
