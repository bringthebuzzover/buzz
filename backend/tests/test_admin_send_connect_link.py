"""Admin Connect link for orgs that never connected Instagram (pre-approval).

Signup is Instagram-first, so ``approve_org`` refuses an org without Graph
credentials. Orgs that verified their ``.edu`` under the retired apply-first
flow never did the OAuth handshake, so approval used to freeze them: a plain
Instagram login collides with their own claimed handle, their ``.edu`` is
uniquely indexed, and both Connect actions refused them. The admin
``send-connect-link`` action is the exit. These tests pin it end to end,
including that the bind it enables never activates the org.
"""

from __future__ import annotations

from unittest.mock import AsyncMock
from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.exceptions import BuzzAPIException
from app.models.enums import OrgUserStatus, PortalRole
from app.models.org_connect_token import OrgConnectToken
from app.services.admin import approve_org, resend_org_connect, send_org_connect_link
from app.services.org_connect import org_connect_action
from tests.conftest import (
    FakeInstagramClient,
    admin_headers,
    make_awaiting_connect,
    make_org,
    make_user,
    persist,
)


async def _unbound_pending_org(
    db_session, *, handle: str = "legacyclub", email: str = "club@t.edu"
):
    """The apply-first backlog: .edu verified, awaiting approval, no IG credentials."""
    user = await persist(
        db_session,
        make_user(
            role=PortalRole.ORG,
            status=OrgUserStatus.PENDING_APPROVAL,
            instagram_user_id=None,
            instagram_username=handle,
        ),
    )
    user.edu_email = email
    org = await make_org(db_session, user, org_name="Legacy Club")
    await db_session.flush()
    return user, org


def _capture_sender(monkeypatch) -> AsyncMock:
    """Replace the dedicated sender and capture the raw token it was handed."""
    sent = AsyncMock(return_value=True)
    monkeypatch.setattr("app.services.admin.send_org_connect_before_approval_email", sent)
    return sent


async def _redeem_and_bind(app_client: AsyncClient, raw: str):
    """Redeem a Connect token, then run the bind OAuth it authorizes."""
    redeemed = await app_client.post("/api/auth/org-connect/redeem", json={"token": raw})
    assert redeemed.status_code == 200, redeemed.text
    bind_headers = {"Authorization": f"Bearer {redeemed.json()['data']['access_token']}"}
    start = await app_client.post("/api/auth/instagram/bind-start", headers=bind_headers)
    assert start.status_code == 200, start.text
    state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
    bound = await app_client.post(
        "/api/auth/instagram/callback", json={"code": "bind", "state": state}
    )
    return redeemed, bound


class TestSendConnectLink:
    async def test_unbound_pending_org_gets_a_connect_link(
        self, app_client: AsyncClient, db_session, monkeypatch
    ) -> None:
        sent = _capture_sender(monkeypatch)
        user, org = await _unbound_pending_org(db_session)
        headers = await admin_headers(db_session)

        res = await app_client.post(f"/api/admin/orgs/{org.id}/send-connect-link", headers=headers)

        assert res.status_code == 200, res.text
        body = res.json()["data"]
        assert body["status"] == OrgUserStatus.PENDING_APPROVAL.value
        assert body["emailQueued"] is True
        sent.assert_awaited_once()
        assert sent.await_args.args[0] == "club@t.edu"
        assert sent.await_args.kwargs["connect_token"]
        assert sent.await_args.kwargs["claimed_handle"] == "legacyclub"
        # Nothing about approval changed; the org is still pending and unbound.
        await db_session.refresh(user)
        assert user.status == OrgUserStatus.PENDING_APPROVAL.value
        assert user.instagram_user_id is None
        # Exactly one usable token exists, hashed at rest.
        rows = list(
            await db_session.scalars(
                select(OrgConnectToken).where(OrgConnectToken.org_id == org.id)
            )
        )
        assert len(rows) == 1
        assert rows[0].used_at is None
        assert rows[0].token_hash != sent.await_args.kwargs["connect_token"]

    async def test_redeem_lets_it_bind_without_becoming_active(
        self,
        app_client: AsyncClient,
        db_session,
        fake_instagram: FakeInstagramClient,
        monkeypatch,
    ) -> None:
        sent = _capture_sender(monkeypatch)
        user, org = await _unbound_pending_org(db_session)
        headers = await admin_headers(db_session)
        await app_client.post(f"/api/admin/orgs/{org.id}/send-connect-link", headers=headers)
        raw = sent.await_args.kwargs["connect_token"]

        fake_instagram.user_id = "ig_legacy"
        fake_instagram.username = "legacyclub"
        redeemed = await app_client.post("/api/auth/org-connect/redeem", json={"token": raw})
        assert redeemed.status_code == 200, redeemed.text

        session_user = redeemed.json()["data"]["user"]
        assert session_user["status"] == OrgUserStatus.PENDING_APPROVAL.value
        assert session_user["instagram_connect_required"] is True
        assert session_user["instagram_reconnect_required"] is False
        # The session cannot reach a portal route before approval.
        bind_headers = {"Authorization": f"Bearer {redeemed.json()['data']['access_token']}"}
        portal = await app_client.get("/api/orgs/me", headers=bind_headers)
        assert portal.status_code == 403

        start = await app_client.post("/api/auth/instagram/bind-start", headers=bind_headers)
        assert start.status_code == 200, start.text
        state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
        bound = await app_client.post(
            "/api/auth/instagram/callback", json={"code": "bind", "state": state}
        )
        assert bound.status_code == 200, bound.text
        await db_session.refresh(user)
        assert user.instagram_user_id == "ig_legacy"
        assert user.instagram_access_token is not None
        # The bind does not activate: approval is still an admin decision.
        assert user.status == OrgUserStatus.PENDING_APPROVAL.value
        assert bound.json()["data"]["user"]["status"] == OrgUserStatus.PENDING_APPROVAL.value
        assert bound.json()["data"]["user"]["instagram_connect_required"] is False

    async def test_approval_succeeds_after_the_bind(
        self,
        app_client: AsyncClient,
        db_session,
        fake_instagram: FakeInstagramClient,
        monkeypatch,
    ) -> None:
        sent = _capture_sender(monkeypatch)
        user, org = await _unbound_pending_org(db_session)
        headers = await admin_headers(db_session)

        # Before the bind, approval is refused — the gate this PR deliberately keeps.
        with pytest.raises(BuzzAPIException) as blocked:
            await approve_org(db_session, org.id, tester_invite_confirmed=True)
        assert blocked.value.status_code == 400

        await app_client.post(f"/api/admin/orgs/{org.id}/send-connect-link", headers=headers)
        fake_instagram.user_id = "ig_after"
        fake_instagram.username = "legacyclub"
        _redeemed, bound = await _redeem_and_bind(
            app_client, sent.await_args.kwargs["connect_token"]
        )
        assert bound.status_code == 200, bound.text
        await db_session.refresh(user)
        assert user.status == OrgUserStatus.PENDING_APPROVAL.value

        approved = await app_client.post(
            f"/api/admin/orgs/{org.id}/approve",
            json={"testerInviteConfirmed": True},
            headers=headers,
        )
        assert approved.status_code == 200, approved.text
        await db_session.refresh(user)
        assert user.status == OrgUserStatus.ACTIVE.value
        assert approved.json()["data"]["status"] == OrgUserStatus.ACTIVE.value

    async def test_bound_pending_org_is_refused(self, db_session, monkeypatch) -> None:
        _capture_sender(monkeypatch)
        user = await persist(
            db_session,
            make_user(
                role=PortalRole.ORG,
                status=OrgUserStatus.PENDING_APPROVAL,
                instagram_user_id="ig_already_bound",
            ),
        )
        user.edu_email = "bound@t.edu"
        org = await make_org(db_session, user)
        with pytest.raises(BuzzAPIException) as exc:
            await send_org_connect_link(db_session, org.id)
        assert exc.value.status_code == 400
        assert "not waiting to connect" in exc.value.message
        assert (
            await db_session.scalar(
                select(OrgConnectToken.id).where(OrgConnectToken.org_id == org.id)
            )
            is None
        )

    async def test_active_org_without_a_switch_is_refused(self, db_session, monkeypatch) -> None:
        _capture_sender(monkeypatch)
        user = await persist(
            db_session,
            make_user(
                role=PortalRole.ORG,
                status=OrgUserStatus.ACTIVE,
                instagram_user_id=None,
            ),
        )
        user.edu_email = "active@t.edu"
        org = await make_org(db_session, user)
        with pytest.raises(BuzzAPIException) as exc:
            await send_org_connect_link(db_session, org.id)
        assert exc.value.status_code == 400

    async def test_erased_org_is_refused(
        self, app_client: AsyncClient, db_session, monkeypatch
    ) -> None:
        sent = _capture_sender(monkeypatch)
        user = await persist(
            db_session,
            make_user(
                role=PortalRole.ORG,
                status=OrgUserStatus.ERASED,
                instagram_user_id=None,
            ),
        )
        user.edu_email = None
        org = await make_org(db_session, user)
        headers = await admin_headers(db_session)
        res = await app_client.post(f"/api/admin/orgs/{org.id}/send-connect-link", headers=headers)
        assert res.status_code == 409
        sent.assert_not_awaited()
        assert (
            await db_session.scalar(
                select(OrgConnectToken.id).where(OrgConnectToken.org_id == org.id)
            )
            is None
        )

    async def test_brand_owned_org_row_is_refused(self, db_session, monkeypatch) -> None:
        """A brand-role user cannot be handed an org Connect link."""
        _capture_sender(monkeypatch)
        brand_user = await persist(
            db_session, make_user(role=PortalRole.BRAND, instagram_user_id=None)
        )
        # Data anomaly the service must still refuse rather than email.
        org = await make_org(db_session, brand_user, org_name="Not An Org")

        with pytest.raises(BuzzAPIException) as exc:
            await send_org_connect_link(db_session, org.id)
        assert exc.value.status_code == 404
        assert (
            await db_session.scalar(
                select(OrgConnectToken.id).where(OrgConnectToken.org_id == org.id)
            )
            is None
        )

    async def test_without_school_email_refuses_instead_of_claiming_success(
        self, db_session, monkeypatch
    ) -> None:
        sent = _capture_sender(monkeypatch)
        user, org = await _unbound_pending_org(db_session)
        user.edu_email = None
        await db_session.flush()
        with pytest.raises(BuzzAPIException) as exc:
            await send_org_connect_link(db_session, org.id)
        assert exc.value.status_code == 400
        sent.assert_not_awaited()
        assert (
            await db_session.scalar(
                select(OrgConnectToken.id).where(OrgConnectToken.org_id == org.id)
            )
            is None
        )

    async def test_switch_holder_still_uses_resend_connect(
        self, app_client: AsyncClient, db_session, monkeypatch
    ) -> None:
        """No regression: an approved switch keeps its existing action."""
        switch_mail = AsyncMock(return_value=True)
        monkeypatch.setattr("app.services.admin.send_org_ig_switch_connect_email", switch_mail)
        _capture_sender(monkeypatch)
        user = await persist(
            db_session,
            make_user(
                role=PortalRole.ORG,
                status=OrgUserStatus.ACTIVE,
                instagram_user_id=None,
                instagram_username="newclub",
            ),
        )
        user.edu_email = "switch@t.edu"
        org = await make_org(db_session, user)
        await make_awaiting_connect(db_session, user, org, current_handle="oldclub")

        assert await org_connect_action(db_session, user) == "switch"

        headers = await admin_headers(db_session)
        resend = await app_client.post(f"/api/admin/orgs/{org.id}/resend-connect", headers=headers)
        assert resend.status_code == 200, resend.text
        switch_mail.assert_awaited_once()

        # The new action refuses the switch holder; the old one still serves it.
        with pytest.raises(BuzzAPIException) as exc:
            await send_org_connect_link(db_session, org.id)
        assert exc.value.status_code == 400
        assert await resend_org_connect(db_session, org.id) is not None

    async def test_switch_holder_token_still_redeems(self, db_session) -> None:
        """The widened redeem check did not break the switch cohort."""
        from app.services.org_connect import (
            create_org_connect_token,
            redeem_org_connect_token,
        )

        user = await persist(
            db_session,
            make_user(
                role=PortalRole.ORG,
                status=OrgUserStatus.ACTIVE,
                instagram_user_id=None,
                instagram_username="newclub",
            ),
        )
        user.edu_email = "switch@t.edu"
        org = await make_org(db_session, user)
        await make_awaiting_connect(db_session, user, org, current_handle="oldclub")

        raw, _ = await create_org_connect_token(db_session, org, user)
        assert (await redeem_org_connect_token(db_session, raw)).id == user.id
