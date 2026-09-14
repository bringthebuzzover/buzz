"""Bulk Connect email: pending_instagram only (not unverified / awaiting approval)."""

from __future__ import annotations

from unittest.mock import AsyncMock

from httpx import AsyncClient

from app.models.enums import OrgUserStatus, PortalRole
from tests.conftest import make_org, make_user, mint_access_token, persist


async def _admin_headers(db_session) -> dict:
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


async def _org(
    db_session,
    *,
    status: OrgUserStatus,
    email: str | None,
    name: str,
):
    user = await persist(
        db_session,
        make_user(role=PortalRole.ORG, status=status, instagram_user_id=None),
    )
    user.edu_email = email
    org = await make_org(db_session, user, org_name=name)
    return user, org


async def test_resend_connect_all_only_pending_instagram(
    app_client: AsyncClient, db_session, monkeypatch
) -> None:
    approved_mail = AsyncMock(return_value=True)
    switch_mail = AsyncMock(return_value=True)
    monkeypatch.setattr("app.services.admin.send_org_approved_email", approved_mail)
    monkeypatch.setattr("app.services.admin.send_org_ig_switch_connect_email", switch_mail)

    await _org(
        db_session,
        status=OrgUserStatus.PENDING_INSTAGRAM,
        email="connect-me@test.edu",
        name="Waiting Connect",
    )
    await _org(
        db_session,
        status=OrgUserStatus.PENDING_EMAIL_VERIFICATION,
        email="unverified@test.edu",
        name="Unverified",
    )
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
        status=OrgUserStatus.PENDING_INSTAGRAM,
        email=None,
        name="No School Email",
    )

    headers = await _admin_headers(db_session)
    resp = await app_client.post("/api/admin/orgs/resend-connect-all", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["targeted"] == 2
    assert data["sent"] == 1
    assert data["failed"] == 0
    assert data["skipped"] == 1

    assert approved_mail.await_count == 1
    assert approved_mail.await_args.args[0] == "connect-me@test.edu"
    assert approved_mail.await_args.kwargs["connect_token"]
    switch_mail.assert_not_awaited()


async def test_resend_connect_all_counts_send_failure(
    app_client: AsyncClient, db_session, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.services.admin.send_org_approved_email",
        AsyncMock(return_value=False),
    )
    await _org(
        db_session,
        status=OrgUserStatus.PENDING_INSTAGRAM,
        email="fail@test.edu",
        name="Fail Send",
    )
    headers = await _admin_headers(db_session)
    resp = await app_client.post("/api/admin/orgs/resend-connect-all", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data == {"targeted": 1, "sent": 0, "failed": 1, "skipped": 0}


async def test_resend_connect_all_empty(app_client: AsyncClient, db_session) -> None:
    headers = await _admin_headers(db_session)
    resp = await app_client.post("/api/admin/orgs/resend-connect-all", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"] == {
        "targeted": 0,
        "sent": 0,
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
