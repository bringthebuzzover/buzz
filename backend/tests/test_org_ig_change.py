"""Org Instagram identity change requests (PRODUCT §3.1.4)."""

from __future__ import annotations

from unittest.mock import AsyncMock
from urllib.parse import parse_qs, urlparse

from httpx import AsyncClient
from sqlalchemy import select

from app.jobs.metric_sync import sync_metrics_for_orgs
from app.models.enums import ApplicationDecision, OrgUserStatus, PortalRole
from app.models.org_ig_change_request import OrgIgChangeRequest
from app.models.post_link import PostCampaignLink
from app.models.social_post import SocialPost
from app.models.user import User
from app.security.token_crypto import encrypt_token
from tests.conftest import (
    FakeInstagramClient,
    make_application,
    make_brand,
    make_drop,
    make_org,
    make_post_link,
    make_social_post,
    make_user,
    mint_access_token,
    persist,
)


async def _admin_headers(db_session) -> dict:
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


async def _active_org(db_session, *, handle: str = "campusgreeks", graph_id: str = "ig_a"):
    user = await persist(
        db_session,
        make_user(
            role=PortalRole.ORG,
            instagram_user_id=graph_id,
            instagram_username=handle,
        ),
    )
    user.instagram_token_user_id = graph_id
    user.instagram_access_token = encrypt_token("tok-a")
    user.edu_email = "officer@school.edu"
    org = await make_org(db_session, user, org_name="Campus Greeks")
    await db_session.flush()
    return user, org


def _body(**overrides: object) -> dict:
    payload: dict[str, object] = {
        "requestedHandle": "newcampusig",
        "reason": "We lost access to the old club account.",
    }
    payload.update(overrides)
    return payload


class TestOrgIgChangeRequest:
    async def test_submit_and_get_state(self, app_client: AsyncClient, db_session):
        user, _org = await _active_org(db_session)
        headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        res = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(),
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["status"] == "pending"
        assert data["requestedHandle"] == "newcampusig"

        state = await app_client.get("/api/orgs/me/ig-change-request", headers=headers)
        assert state.json()["data"]["pending"]["id"] == data["id"]

        again = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(requestedHandle="otherclub"),
            headers=headers,
        )
        assert again.status_code == 409

    async def test_submit_validates(self, app_client: AsyncClient, db_session):
        user, _org = await _active_org(db_session)
        headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        same = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(requestedHandle="campusgreeks"),
            headers=headers,
        )
        assert same.status_code == 400
        short = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(reason="short"),
            headers=headers,
        )
        assert short.status_code == 400

        other = await persist(
            db_session,
            make_user(role=PortalRole.ORG, instagram_username="takenhandle"),
        )
        await make_org(db_session, other, org_name="Taken")
        taken = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(requestedHandle="takenhandle"),
            headers=headers,
        )
        assert taken.status_code == 409

        still = await app_client.patch(
            "/api/orgs/me",
            json={"instagramHandle": "evilorg"},
            headers=headers,
        )
        assert still.status_code == 422

    async def test_approve_rename_does_not_write_handle(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        rename_mail = AsyncMock(return_value=True)
        monkeypatch.setattr(
            "app.services.ig_change_requests.send_org_ig_rename_approved_email",
            rename_mail,
        )
        user, _org = await _active_org(db_session)
        org_headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        created = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(kind="rename"),
            headers=org_headers,
        )
        request_id = created.json()["data"]["id"]
        admin = await _admin_headers(db_session)
        res = await app_client.post(
            f"/api/admin/ig-change-requests/{request_id}/approve",
            json={"kind": "rename"},
            headers=admin,
        )
        assert res.status_code == 200, res.text
        assert res.json()["data"]["emailSent"] is True
        rename_mail.assert_awaited_once()
        assert rename_mail.await_args.args[0] == "officer@school.edu"
        await db_session.refresh(user)
        await db_session.refresh(_org)
        assert user.status == OrgUserStatus.ACTIVE.value
        assert user.instagram_username == "campusgreeks"
        assert user.instagram_user_id == "ig_a"
        assert _org.claimed_instagram_username == "campusgreeks"

    async def test_switch_requires_tester_and_releases_graph(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        switch_mail = AsyncMock(return_value=True)
        monkeypatch.setattr(
            "app.services.ig_change_requests.send_org_ig_switch_connect_email",
            switch_mail,
        )
        user, org = await _active_org(db_session)
        user.token_version = 1
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        app = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
        post = await make_social_post(db_session, org, external_id="media_a", likes=44, comments=7)
        await make_post_link(db_session, post, app)
        await db_session.flush()

        org_headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        created = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(),
            headers=org_headers,
        )
        request_id = created.json()["data"]["id"]
        admin = await _admin_headers(db_session)

        refused = await app_client.post(
            f"/api/admin/ig-change-requests/{request_id}/approve",
            json={"kind": "account_switch", "testerInviteConfirmed": False},
            headers=admin,
        )
        assert refused.status_code == 400
        await db_session.refresh(user)
        assert user.status == OrgUserStatus.ACTIVE.value
        assert user.instagram_user_id == "ig_a"

        overview = await app_client.get("/api/admin/overview", headers=admin)
        keys = [q["key"] for q in overview.json()["data"]["queues"]]
        assert "orgs_ig_change_pending" in keys
        assert any(
            q["key"] == "orgs_ig_change_pending" and q["count"] == 1
            for q in overview.json()["data"]["queues"]
        )

        approved = await app_client.post(
            f"/api/admin/ig-change-requests/{request_id}/approve",
            json={"kind": "account_switch", "testerInviteConfirmed": True},
            headers=admin,
        )
        assert approved.status_code == 200, approved.text
        assert approved.json()["data"]["emailSent"] is True
        switch_mail.assert_awaited_once()
        assert switch_mail.await_args.args[0] == "officer@school.edu"
        await db_session.refresh(user)
        assert user.status == OrgUserStatus.PENDING_INSTAGRAM.value
        assert user.instagram_user_id is None
        assert user.instagram_token_user_id is None
        assert user.instagram_access_token is None
        assert user.instagram_username == "newcampusig"
        await db_session.refresh(org)
        assert org.claimed_instagram_username == "newcampusig"
        assert org.ig_bind_mismatched_at is None
        assert org.ig_bind_mismatch_acked_at is None
        assert user.token_version == 2
        resend_mail = AsyncMock(return_value=True)
        monkeypatch.setattr(
            "app.services.admin.send_org_ig_switch_connect_email",
            resend_mail,
        )
        resend = await app_client.post(
            f"/api/admin/orgs/{org.id}/resend-connect",
            headers=admin,
        )
        assert resend.status_code == 200, resend.text
        resend_mail.assert_awaited()
        assert await db_session.get(SocialPost, post.id)
        assert await db_session.scalar(
            select(PostCampaignLink).where(PostCampaignLink.post_id == post.id)
        )

    async def test_switch_then_old_login_and_new_bind(
        self,
        app_client: AsyncClient,
        db_session,
        fake_instagram: FakeInstagramClient,
        monkeypatch,
    ):
        monkeypatch.setattr(
            "app.services.ig_change_requests.send_org_ig_switch_connect_email",
            AsyncMock(return_value=True),
        )
        user, org = await _active_org(db_session)
        post = await make_social_post(db_session, org, external_id="media_a", likes=44)
        org_headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        created = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(),
            headers=org_headers,
        )
        admin = await _admin_headers(db_session)
        await app_client.post(
            f"/api/admin/ig-change-requests/{created.json()['data']['id']}/approve",
            json={"kind": "account_switch", "testerInviteConfirmed": True},
            headers=admin,
        )
        await db_session.refresh(user)

        fake_instagram.account_type = "BUSINESS"
        fake_instagram.user_id = "ig_a"
        login = await app_client.get("/api/auth/instagram/login", follow_redirects=False)
        state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
        old = await app_client.post(
            "/api/auth/instagram/callback",
            json={"code": "old-a", "state": state},
        )
        assert old.status_code == 400
        assert old.json()["error"]["code"] == "ORG_APPLY_REQUIRED"

        fake_instagram.user_id = "ig_b"
        fake_instagram.username = "newcampusig"
        bind_headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        start = await app_client.post("/api/auth/instagram/bind-start", headers=bind_headers)
        assert start.status_code == 200, start.text
        bind_state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
        bound = await app_client.post(
            "/api/auth/instagram/callback",
            json={"code": "bind-b", "state": bind_state},
        )
        assert bound.status_code == 200, bound.text
        await db_session.refresh(user)
        assert user.status == OrgUserStatus.ACTIVE.value
        assert user.instagram_user_id == "ig_b"
        kept = await db_session.get(SocialPost, post.id)
        assert kept is not None and kept.likes == 44

        async def boom(_token: str, media_id: str):
            if media_id == "media_a":
                raise RuntimeError("media not found")
            raise RuntimeError("unexpected")

        fake_instagram.fetch_media = boom  # type: ignore[method-assign]
        await sync_metrics_for_orgs(db_session, fake_instagram, [org])
        await db_session.refresh(kept)
        assert kept.likes == 44

        profile = await app_client.get(
            "/api/orgs/me",
            headers={"Authorization": f"Bearer {mint_access_token(user)}"},
        )
        assert profile.json()["data"]["previousInstagramHandle"] == "campusgreeks"
        assert profile.json()["data"]["igSwitchedAt"] is not None

    async def test_deny_writes_nothing(self, app_client: AsyncClient, db_session, monkeypatch):
        deny_mail = AsyncMock(return_value=True)
        monkeypatch.setattr(
            "app.services.ig_change_requests.send_org_ig_change_denied_email",
            deny_mail,
        )
        user, _org = await _active_org(db_session)
        created = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(),
            headers={"Authorization": f"Bearer {mint_access_token(user)}"},
        )
        admin = await _admin_headers(db_session)
        denied = await app_client.post(
            f"/api/admin/ig-change-requests/{created.json()['data']['id']}/deny",
            headers=admin,
        )
        assert denied.status_code == 200
        assert denied.json()["data"]["emailSent"] is True
        deny_mail.assert_awaited_once()
        assert deny_mail.await_args.args[0] == "officer@school.edu"
        await db_session.refresh(user)
        assert user.instagram_user_id == "ig_a"
        assert user.status == OrgUserStatus.ACTIVE.value
        row = await db_session.get(OrgIgChangeRequest, created.json()["data"]["id"])
        assert row is not None and row.status == "denied"
        assert await db_session.get(User, user.id)
