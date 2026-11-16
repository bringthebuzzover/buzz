"""Bulk Connect email: both connect cohorts, not unverified / profileless orgs."""

from __future__ import annotations

from unittest.mock import AsyncMock

from httpx import AsyncClient

from app.models.enums import OrgUserStatus, PortalRole
from tests.conftest import (
    admin_headers,
    make_awaiting_connect,
    make_org,
    make_user,
    mint_access_token,
    persist,
)


async def _org(
    db_session,
    *,
    status: OrgUserStatus,
    email: str | None,
    name: str,
    reconnect: bool = False,
):
    user = await persist(
        db_session,
        make_user(role=PortalRole.ORG, status=status, instagram_user_id=None),
    )
    user.edu_email = email
    org = await make_org(db_session, user, org_name=name)
    if reconnect:
        await make_awaiting_connect(db_session, user, org)
    return user, org


async def test_resend_connect_all_targets_both_cohorts(
    app_client: AsyncClient, db_session, monkeypatch
) -> None:
    approved_mail = AsyncMock(return_value=True)
    switch_mail = AsyncMock(return_value=True)
    initial_mail = AsyncMock(return_value=True)
    monkeypatch.setattr("app.services.admin.send_org_approved_email", approved_mail)
    monkeypatch.setattr("app.services.admin.send_org_ig_switch_connect_email", switch_mail)
    monkeypatch.setattr("app.services.admin.send_org_connect_before_approval_email", initial_mail)

    await _org(
        db_session,
        status=OrgUserStatus.ACTIVE,
        email="connect-me@test.edu",
        name="Waiting Connect",
        reconnect=True,
    )
    await _org(
        db_session,
        status=OrgUserStatus.PENDING_EMAIL_VERIFICATION,
        email="unverified@test.edu",
        name="Unverified",
    )
    # Verified .edu under the apply-first flow, never connected: approval is
    # blocked until it does, so the bulk action has to reach it.
    await _org(
        db_session,
        status=OrgUserStatus.PENDING_APPROVAL,
        email="awaiting@test.edu",
        name="Awaiting Approval",
    )
    await _org(
        db_session,
        status=OrgUserStatus.PENDING_ORG_PROFILE,
        email="no-profile@test.edu",
        name="No Profile",
    )
    await _org(
        db_session,
        status=OrgUserStatus.ACTIVE,
        email="active@test.edu",
        name="Already Active",
    )
    await _org(
        db_session,
        status=OrgUserStatus.ACTIVE,
        email=None,
        name="No School Email",
        reconnect=True,
    )

    headers = await admin_headers(db_session)
    resp = await app_client.post("/api/admin/orgs/resend-connect-all", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["targeted"] == 3
    assert data["queued"] == 2
    assert data["failed"] == 0
    assert data["skipped"] == 1

    # Switch holder still hears from the switch sender; the never-connected org
    # hears the honest pre-approval copy. Each cohort gets exactly one email.
    assert switch_mail.await_count == 1
    assert switch_mail.await_args.args[0] == "connect-me@test.edu"
    assert switch_mail.await_args.kwargs["connect_token"]
    assert initial_mail.await_count == 1
    assert initial_mail.await_args.args[0] == "awaiting@test.edu"
    assert initial_mail.await_args.kwargs["connect_token"]
    approved_mail.assert_not_awaited()


async def test_migrated_legacy_org_can_be_reached_by_resend_connect(
    app_client: AsyncClient, db_session, monkeypatch
) -> None:
    """A legacy ``pending_instagram`` org rescued by the migration is reachable.

    The retirement migration turns every unbound legacy org into ``active`` plus
    a synthesized ``awaiting_connect`` ticket naming the handle it claimed. The
    admin "resend Connect" action must reach it — before the fix these orgs
    landed in ``pending_approval``, where ``resend_org_connect`` 400s and every
    other exit path refuses them.
    """
    from app.services.admin import resend_org_connect
    from app.services.org_connect import org_owes_instagram_reconnect

    switch_mail = AsyncMock(return_value=True)
    monkeypatch.setattr("app.services.admin.send_org_ig_switch_connect_email", switch_mail)

    user = await persist(
        db_session,
        make_user(
            role=PortalRole.ORG,
            status=OrgUserStatus.ACTIVE,
            instagram_user_id=None,
            instagram_username="legacyclub",
        ),
    )
    user.edu_email = "legacy@test.edu"
    org = await make_org(db_session, user, org_name="Legacy Apply First")
    # Exactly the ticket shape the migration synthesizes: no switch target.
    await make_awaiting_connect(
        db_session, user, org, current_handle=None, is_migration_placeholder=True
    )
    await db_session.flush()

    assert await org_owes_instagram_reconnect(db_session, user) is True
    out = await resend_org_connect(db_session, org.id)
    assert out["status"] == OrgUserStatus.ACTIVE.value
    switch_mail.assert_awaited_once()
    assert switch_mail.await_args.args[0] == "legacy@test.edu"
    assert switch_mail.await_args.kwargs["requested_handle"] == "legacyclub"
    assert switch_mail.await_args.kwargs["connect_token"]


async def test_resend_connect_all_acknowledges_queued_send(
    app_client: AsyncClient, db_session, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.services.admin.send_org_ig_switch_connect_email",
        AsyncMock(return_value=False),
    )
    await _org(
        db_session,
        status=OrgUserStatus.ACTIVE,
        email="fail@test.edu",
        name="Fail Send",
        reconnect=True,
    )
    headers = await admin_headers(db_session)
    resp = await app_client.post("/api/admin/orgs/resend-connect-all", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data == {"targeted": 1, "queued": 1, "failed": 0, "skipped": 0}


async def test_resend_connect_all_empty(app_client: AsyncClient, db_session) -> None:
    headers = await admin_headers(db_session)
    resp = await app_client.post("/api/admin/orgs/resend-connect-all", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"] == {
        "targeted": 0,
        "queued": 0,
        "failed": 0,
        "skipped": 0,
    }


async def test_resend_connect_all_org_forbidden(app_client: AsyncClient, db_session) -> None:
    org_user = await persist(db_session, make_user(role=PortalRole.ORG))
    resp = await app_client.post(
        "/api/admin/orgs/resend-connect-all",
        headers={"Authorization": f"Bearer {mint_access_token(org_user)}"},
    )
    assert resp.status_code == 403
