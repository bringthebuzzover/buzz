"""Org Instagram identity change requests (PRODUCT §3.1.4)."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock
from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.exceptions import BuzzAPIException
from app.jobs.metric_sync import sync_metrics_for_orgs
from app.models.enums import ApplicationDecision, OrgUserStatus, PortalRole
from app.models.org_ig_change_request import OrgIgChangeRequest
from app.models.post_link import PostCampaignLink
from app.models.social_post import SocialPost
from app.models.user import User
from app.security.token_crypto import encrypt_token
from app.services.ig_change_requests import approve_request
from app.services.org_connect import create_org_connect_token, redeem_org_connect_token
from app.timeutils import utcnow
from tests.conftest import (
    FakeInstagramClient,
    admin_headers,
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
        admin = await admin_headers(db_session)
        res = await app_client.post(
            f"/api/admin/ig-change-requests/{request_id}/approve",
            json={"kind": "rename"},
            headers=admin,
        )
        assert res.status_code == 200, res.text
        assert res.json()["data"]["emailQueued"] is True
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
        admin = await admin_headers(db_session)

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
        assert approved.json()["data"]["emailQueued"] is True
        assert approved.json()["data"]["status"] == "awaiting_connect"
        switch_mail.assert_awaited_once()
        assert switch_mail.await_args.args[0] == "officer@school.edu"
        await db_session.refresh(user)
        assert user.status == OrgUserStatus.ACTIVE.value
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
        admin = await admin_headers(db_session)
        await app_client.post(
            f"/api/admin/ig-change-requests/{created.json()['data']['id']}/approve",
            json={"kind": "account_switch", "testerInviteConfirmed": True},
            headers=admin,
        )
        await db_session.refresh(user)
        # The emailed one-shot link mints only a reconnect session.
        raw, _ = await create_org_connect_token(db_session, org, user)
        assert (await redeem_org_connect_token(db_session, raw)).id == user.id
        with pytest.raises(BuzzAPIException):
            await redeem_org_connect_token(db_session, raw)
        bind_headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        me = await app_client.get("/api/auth/me", headers=bind_headers)
        assert me.json()["data"]["status"] == "active"
        assert me.json()["data"]["instagram_reconnect_required"] is True
        portal = await app_client.get("/api/orgs/me", headers=bind_headers)
        assert portal.status_code == 403
        listing = await app_client.get("/api/admin/orgs?status=awaiting_connect", headers=admin)
        assert [row["userId"] for row in listing.json()["data"]] == [str(user.id)]
        assert listing.json()["data"][0]["instagramReconnectRequired"] is True

        unused_raw, _ = await create_org_connect_token(db_session, org, user)
        fake_instagram.account_type = "BUSINESS"
        fake_instagram.user_id = "ig_a"
        login = await app_client.get("/api/auth/instagram/login", follow_redirects=False)
        state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
        old = await app_client.post(
            "/api/auth/instagram/callback",
            json={"code": "old-a", "state": state},
        )
        # A disconnected identity can start a new application, but cannot
        # regain the switched organization's active session.
        assert old.status_code == 200
        assert old.json()["data"]["user"]["status"] == "pending_org_profile"
        assert old.json()["data"]["user"]["id"] != str(user.id)

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
        assert bound.json()["data"]["user"]["instagram_reconnect_required"] is False
        request = await db_session.get(OrgIgChangeRequest, created.json()["data"]["id"])
        assert request.status == "approved"
        with pytest.raises(BuzzAPIException):
            await redeem_org_connect_token(db_session, unused_raw)
        replay = await app_client.post(
            "/api/auth/instagram/bind-start",
            headers={"Authorization": f"Bearer {mint_access_token(user)}"},
        )
        assert replay.status_code == 400
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

    async def test_second_switch_refused_while_one_awaits_connect(
        self, app_client: AsyncClient, db_session, monkeypatch
    ):
        """An open reconnect must finish before another switch can be approved.

        ``user.status`` stays ``active`` while an org owes a reconnect, so the
        old active-only guard let a second switch stack a second live
        ``awaiting_connect`` row; one bind then closed both. Two layers now
        refuse it: the partial unique index covers both open states, and
        ``approve_request`` refuses an ``account_switch`` for an org that
        already owes a reconnect.
        """
        monkeypatch.setattr(
            "app.services.ig_change_requests.send_org_ig_switch_connect_email",
            AsyncMock(return_value=True),
        )
        user, org = await _active_org(db_session)
        admin = await admin_headers(db_session)
        first = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(requestedHandle="firstnewclub"),
            headers={"Authorization": f"Bearer {mint_access_token(user)}"},
        )
        assert first.status_code == 200, first.text
        approved = await app_client.post(
            f"/api/admin/ig-change-requests/{first.json()['data']['id']}/approve",
            json={"kind": "account_switch", "testerInviteConfirmed": True},
            headers=admin,
        )
        assert approved.status_code == 200, approved.text
        await db_session.refresh(user)
        assert user.status == OrgUserStatus.ACTIVE.value

        # The org cannot submit another request while it owes the reconnect
        # (the portal is closed by credential absence).
        second = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(requestedHandle="secondnewclub"),
            headers={"Authorization": f"Bearer {mint_access_token(user)}"},
        )
        assert second.status_code == 403

    async def test_approve_refuses_when_reconnect_already_owed(self, db_session, monkeypatch):
        """The service guard refuses a switch for an org already owing one.

        A stacked state cannot survive the widened unique index, so the test
        drops the index inside its own transaction (PostgreSQL DDL is
        transactional, so teardown restores it) to reproduce the leftover a
        rolling deploy can see: app code before the index migration.
        """
        from sqlalchemy import text

        monkeypatch.setattr(
            "app.services.ig_change_requests.send_org_ig_switch_connect_email",
            AsyncMock(return_value=True),
        )
        user, org = await _active_org(db_session)
        await db_session.execute(text("DROP INDEX uq_org_ig_change_requests_one_open"))
        await db_session.flush()
        db_session.add_all(
            [
                OrgIgChangeRequest(
                    id=uuid.uuid4(),
                    org_id=org.id,
                    user_id=user.id,
                    kind="account_switch",
                    current_handle="campusgreeks",
                    requested_handle="newcampusig",
                    reason="We lost access to the old club account.",
                    status="awaiting_connect",
                    decided_kind="account_switch",
                    decided_at=utcnow(),
                ),
                OrgIgChangeRequest(
                    id=uuid.uuid4(),
                    org_id=org.id,
                    user_id=user.id,
                    kind="account_switch",
                    current_handle="newcampusig",
                    requested_handle="thirdclub",
                    reason="A second switch stacked behind the open reconnect.",
                    status="pending",
                ),
            ]
        )
        await db_session.flush()
        pending = await db_session.scalar(
            select(OrgIgChangeRequest).where(
                OrgIgChangeRequest.org_id == org.id,
                OrgIgChangeRequest.status == "pending",
            )
        )
        assert pending is not None
        with pytest.raises(BuzzAPIException) as exc:
            await approve_request(
                db_session, pending.id, kind="account_switch", tester_invite_confirmed=True
            )
        assert exc.value.status_code == 400
        assert "finish reconnecting" in exc.value.message
        await db_session.refresh(pending)
        assert pending.status == "pending"
        live = list(
            await db_session.scalars(
                select(OrgIgChangeRequest).where(
                    OrgIgChangeRequest.org_id == org.id,
                    OrgIgChangeRequest.status == "awaiting_connect",
                )
            )
        )
        assert len(live) == 1

    @pytest.mark.parametrize("target", ["renamedclubig", "campusgreeks"])
    async def test_stuck_switch_can_be_retargeted_and_then_bound(
        self, app_client: AsyncClient, db_session, fake_instagram: FakeInstagramClient, target
    ):
        """A renamed handle must not strand an org.

        Approval releases the credentials and closes the portal, so the org
        cannot submit a new request. If the approved handle no longer matches
        anything the org can bind, the strict target check refuses every
        attempt. Retargeting keeps the recovery path open.
        """
        user, _org = await _active_org(db_session)
        created = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(),
            headers={"Authorization": f"Bearer {mint_access_token(user)}"},
        )
        request_id = created.json()["data"]["id"]
        admin = await admin_headers(db_session)

        approved = await app_client.post(
            f"/api/admin/ig-change-requests/{request_id}/approve",
            json={"kind": "account_switch", "testerInviteConfirmed": True},
            headers=admin,
        )
        assert approved.status_code == 200

        await db_session.refresh(user)
        bind_headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
        unauthorized = await app_client.post(
            f"/api/admin/ig-change-requests/{request_id}/retarget",
            json={"requestedHandle": target},
            headers=bind_headers,
        )
        assert unauthorized.status_code == 403
        # Repeating the authorized action is idempotent and never opens the portal.
        for _ in range(2):
            retargeted = await app_client.post(
                f"/api/admin/ig-change-requests/{request_id}/retarget",
                json={"requestedHandle": target},
                headers=admin,
            )
            assert retargeted.status_code == 200, retargeted.text
            assert retargeted.json()["data"]["requestedHandle"] == target
            portal = await app_client.get("/api/orgs/me", headers=bind_headers)
            assert portal.status_code == 403

        row = await db_session.get(OrgIgChangeRequest, request_id)
        assert row is not None
        # Still an open recovery path, now aimed at the real account.
        assert row.status == "awaiting_connect"
        assert row.requested_handle == target
        assert row.is_migration_placeholder is False
        assert user.instagram_user_id is None
        assert user.instagram_access_token is None

        # Even recovery to A must reject an unrelated C and keep the ticket open.
        fake_instagram.user_id = "ig_c"
        fake_instagram.username = "thirdclub"
        start = await app_client.post("/api/auth/instagram/bind-start", headers=bind_headers)
        assert start.status_code == 200, start.text
        state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
        refused = await app_client.post(
            "/api/auth/instagram/callback", json={"code": "bind-c", "state": state}
        )
        assert refused.status_code == 400, refused.text
        await db_session.refresh(row)
        await db_session.refresh(user)
        assert row.status == "awaiting_connect"
        assert user.instagram_user_id is None
        assert user.instagram_access_token is None

        fake_instagram.user_id = "ig_a" if target == "campusgreeks" else "ig_b"
        fake_instagram.username = target
        start = await app_client.post("/api/auth/instagram/bind-start", headers=bind_headers)
        assert start.status_code == 200, start.text
        state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
        bound = await app_client.post(
            "/api/auth/instagram/callback", json={"code": "bind-target", "state": state}
        )
        assert bound.status_code == 200, bound.text
        await db_session.refresh(user)
        await db_session.refresh(row)
        assert row.status == "approved"
        assert user.instagram_user_id == fake_instagram.user_id
        assert user.instagram_username == target
        assert user.instagram_access_token
        portal = await app_client.get(
            "/api/orgs/me", headers={"Authorization": f"Bearer {mint_access_token(user)}"}
        )
        assert portal.status_code == 200, portal.text

    async def test_retarget_rejects_a_handle_another_org_holds(
        self, app_client: AsyncClient, db_session
    ):
        """Retargeting must not let an admin hand over a taken handle."""
        user, _org = await _active_org(db_session)
        created = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(),
            headers={"Authorization": f"Bearer {mint_access_token(user)}"},
        )
        request_id = created.json()["data"]["id"]
        admin = await admin_headers(db_session)
        await app_client.post(
            f"/api/admin/ig-change-requests/{request_id}/approve",
            json={"kind": "account_switch", "testerInviteConfirmed": True},
            headers=admin,
        )

        # A second org holding its own handle. Retargeting must not steal it.
        other = await persist(
            db_session,
            make_user(
                role=PortalRole.ORG, instagram_user_id="ig_b", instagram_username="otherclub"
            ),
        )
        await db_session.flush()

        taken = await app_client.post(
            f"/api/admin/ig-change-requests/{request_id}/retarget",
            json={"requestedHandle": "otherclub"},
            headers=admin,
        )
        assert taken.status_code == 409

        _ = other

    async def test_retarget_moves_the_handle_reservation(self, app_client: AsyncClient, db_session):
        """Ownership follows the ticket.

        Handle uniqueness is enforced through ``users.instagram_username``. If
        retargeting left the old handle there, an ordinary Instagram login for
        the new one could create a separate account holding it, and the org's own
        bind would then fail because that Graph identity belongs to another user.
        """
        user, org = await _active_org(db_session)
        created = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(),
            headers={"Authorization": f"Bearer {mint_access_token(user)}"},
        )
        request_id = created.json()["data"]["id"]
        admin = await admin_headers(db_session)
        await app_client.post(
            f"/api/admin/ig-change-requests/{request_id}/approve",
            json={"kind": "account_switch", "testerInviteConfirmed": True},
            headers=admin,
        )

        retargeted = await app_client.post(
            f"/api/admin/ig-change-requests/{request_id}/retarget",
            json={"requestedHandle": "renamedclubig"},
            headers=admin,
        )
        assert retargeted.status_code == 200

        await db_session.refresh(user)
        assert user.instagram_username == "renamedclubig"

    async def test_retarget_clears_the_migration_placeholder_signature(
        self, app_client: AsyncClient, db_session
    ):
        """A retargeted placeholder must not be recognisable as one.

        ``8d1c70e5a942`` flags placeholders by their migration reason text. If a
        retarget only cleared the boolean, a downgrade and re-upgrade would
        re-derive it from the untouched reason and hand the org the permissive
        "bind any account" behaviour an admin had explicitly overridden.
        """
        user, org = await _active_org(db_session)
        req = OrgIgChangeRequest(
            org_id=org.id,
            user_id=user.id,
            kind="account_switch",
            current_handle="campusgreeks",
            requested_handle="campusgreeks",
            reason=(
                "Reconnect required by the Instagram-first migration: this "
                "organization was approved under the retired pending_instagram "
                "flow and never connected Instagram."
            ),
            status="awaiting_connect",
            decided_kind="account_switch",
            is_migration_placeholder=True,
        )
        db_session.add(req)
        await db_session.flush()
        admin = await admin_headers(db_session)

        retargeted = await app_client.post(
            f"/api/admin/ig-change-requests/{req.id}/retarget",
            json={"requestedHandle": "renamedclubig"},
            headers=admin,
        )
        assert retargeted.status_code == 200

        await db_session.refresh(req)
        assert req.is_migration_placeholder is False
        # The signature the migration keys on is gone.
        assert "Instagram-first migration" not in (req.reason or "")

    async def test_plain_login_cannot_bypass_an_outstanding_switch(
        self, app_client: AsyncClient, db_session, fake_instagram, monkeypatch
    ):
        """Signing in with the old account must not reopen the portal.

        Target enforcement lives on the Connect path. Without this guard, an org
        whose switch to B is approved could log in with A, receive a fresh
        token, and reach the portal while the switch is unfinished.
        """
        monkeypatch.setattr(
            "app.services.ig_change_requests.send_org_ig_switch_connect_email",
            AsyncMock(return_value=True),
        )
        user, _org = await _active_org(db_session)
        created = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(),
            headers={"Authorization": f"Bearer {mint_access_token(user)}"},
        )
        admin = await admin_headers(db_session)
        await app_client.post(
            f"/api/admin/ig-change-requests/{created.json()['data']['id']}/approve",
            json={"kind": "account_switch", "testerInviteConfirmed": True},
            headers=admin,
        )

        # Simulate the legacy residue the migration must clear: an approved
        # switch whose row still carries the *previous* account's Graph id and
        # no token. That is the state in which an ordinary login as A would
        # otherwise match this row and restore a token path that never goes
        # through the switch's target check.
        await db_session.refresh(user)
        user.instagram_user_id = "ig_a"
        user.instagram_token_user_id = None
        user.instagram_access_token = None
        await db_session.flush()

        fake_instagram.account_type = "BUSINESS"
        fake_instagram.user_id = "ig_a"
        fake_instagram.username = "campusgreeks"
        login = await app_client.get("/api/auth/instagram/login", follow_redirects=False)
        state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
        resp = await app_client.post(
            "/api/auth/instagram/callback",
            json={"code": "old-a", "state": state},
        )

        # Refused: the org has to finish the approved switch through Connect.
        assert resp.status_code == 409, resp.text
        assert "reconnect" in resp.text.lower()

    async def test_deny_after_approve_is_refused(self, app_client: AsyncClient, db_session):
        """A decided request cannot be decided again.

        Approval releases the org's credentials and commits an
        ``awaiting_connect`` ticket. If a concurrent denial could still write
        ``denied`` over that row, the org would be active with no credentials
        and no ticket — a state no Connect action can recover. The decision
        paths take a row lock so the loser sees the new status and is refused.
        """
        user, _org = await _active_org(db_session)
        created = await app_client.post(
            "/api/orgs/me/ig-change-requests",
            json=_body(),
            headers={"Authorization": f"Bearer {mint_access_token(user)}"},
        )
        request_id = created.json()["data"]["id"]
        admin = await admin_headers(db_session)

        approved = await app_client.post(
            f"/api/admin/ig-change-requests/{request_id}/approve",
            json={"kind": "account_switch", "testerInviteConfirmed": True},
            headers=admin,
        )
        assert approved.status_code == 200

        denied = await app_client.post(
            f"/api/admin/ig-change-requests/{request_id}/deny", headers=admin
        )
        assert denied.status_code == 400

        row = await db_session.get(OrgIgChangeRequest, request_id)
        assert row is not None
        # The approval stands: the recovery path was not overwritten.
        assert row.status == "awaiting_connect"
        await db_session.refresh(user)
        assert user.instagram_user_id is None

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
        admin = await admin_headers(db_session)
        denied = await app_client.post(
            f"/api/admin/ig-change-requests/{created.json()['data']['id']}/deny",
            headers=admin,
        )
        assert denied.status_code == 200
        assert denied.json()["data"]["emailQueued"] is True
        deny_mail.assert_awaited_once()
        assert deny_mail.await_args.args[0] == "officer@school.edu"
        await db_session.refresh(user)
        assert user.instagram_user_id == "ig_a"
        assert user.status == OrgUserStatus.ACTIVE.value
        row = await db_session.get(OrgIgChangeRequest, created.json()["data"]["id"])
        assert row is not None and row.status == "denied"
        assert await db_session.get(User, user.id)
