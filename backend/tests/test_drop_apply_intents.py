"""``drop_apply_intents``: record, lazy expire, promote, deny/erase (PRODUCT §7.1)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.drop_apply_intent import DropApplyIntent
from app.models.enums import (
    ApplicationDecision,
    DropApplyIntentStatus,
    OrgUserStatus,
    PortalRole,
)
from app.services.drop_apply_intents import (
    expire_stale_intents_for_drop,
    get_intent_for_org_drop,
    list_intents_for_drop,
    promote_drop_apply_intents,
    record_drop_apply_intent,
)
from tests.conftest import (
    FakeInstagramClient,
    make_application,
    make_brand,
    make_drop,
    make_org,
    make_user,
    mint_access_token,
    persist,
)


async def _pending_org(db_session, *, status: OrgUserStatus = OrgUserStatus.PENDING_APPROVAL):
    user = await persist(db_session, make_user(role=PortalRole.ORG, status=status))
    org = await make_org(db_session, user)
    return user, org


async def test_record_open_intent_does_not_create_application(db_session) -> None:
    _, org = await _pending_org(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)

    intent = await record_drop_apply_intent(
        db_session, org_id=org.id, drop_id=drop.id, pitch="  We want in  "
    )
    assert intent.status == DropApplyIntentStatus.OPEN.value
    assert intent.pitch == "We want in"
    apps = list(
        await db_session.scalars(select(DropApplication).where(DropApplication.drop_id == drop.id))
    )
    assert apps == []


async def test_record_closed_window_writes_expired_intent(db_session) -> None:
    _, org = await _pending_org(db_session)
    brand = await make_brand(db_session)
    now = datetime.now(timezone.utc)
    drop = await make_drop(
        db_session,
        brand,
        apply_open_at=now - timedelta(days=8),
        apply_close_at=now - timedelta(days=1),
    )
    intent = await record_drop_apply_intent(
        db_session, org_id=org.id, drop_id=drop.id, pitch="late"
    )
    assert intent.status == DropApplyIntentStatus.EXPIRED.value


async def test_record_upcoming_keeps_open_intent(db_session) -> None:
    _, org = await _pending_org(db_session)
    brand = await make_brand(db_session)
    now = datetime.now(timezone.utc)
    drop = await make_drop(
        db_session,
        brand,
        apply_open_at=now + timedelta(days=2),
        apply_close_at=now + timedelta(days=9),
    )
    intent = await record_drop_apply_intent(
        db_session, org_id=org.id, drop_id=drop.id, pitch="early"
    )
    assert intent.status == DropApplyIntentStatus.OPEN.value


async def test_promote_while_upcoming_leaves_open_then_applies(db_session) -> None:
    user, org = await _pending_org(db_session, status=OrgUserStatus.ACTIVE)
    brand = await make_brand(db_session)
    now = datetime.now(timezone.utc)
    drop = await make_drop(
        db_session,
        brand,
        apply_open_at=now + timedelta(days=2),
        apply_close_at=now + timedelta(days=9),
    )
    intent = await record_drop_apply_intent(
        db_session, org_id=org.id, drop_id=drop.id, pitch="wait"
    )
    await promote_drop_apply_intents(db_session, user)
    await db_session.refresh(intent)
    assert intent.status == DropApplyIntentStatus.OPEN.value
    assert (
        await db_session.scalar(
            select(DropApplication.id).where(DropApplication.drop_id == drop.id)
        )
        is None
    )

    drop.apply_open_at = now - timedelta(hours=1)
    await db_session.flush()
    await promote_drop_apply_intents(db_session, user)
    await db_session.refresh(intent)
    assert intent.status == DropApplyIntentStatus.PROMOTED.value
    app = await db_session.scalar(
        select(DropApplication).where(
            DropApplication.org_id == org.id, DropApplication.drop_id == drop.id
        )
    )
    assert app is not None
    assert app.pitch == "wait"


async def test_record_unknown_uuid_raises_drop_not_open(db_session) -> None:
    _, org = await _pending_org(db_session)
    with pytest.raises(BuzzAPIException) as exc:
        await record_drop_apply_intent(db_session, org_id=org.id, drop_id=uuid.uuid4(), pitch=None)
    assert exc.value.code == errors.DROP_NOT_OPEN


async def test_record_unpublished_raises_drop_not_open(db_session) -> None:
    _, org = await _pending_org(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, published_at=None)
    with pytest.raises(BuzzAPIException) as exc:
        await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop.id, pitch=None)
    assert exc.value.code == errors.DROP_NOT_OPEN


async def test_record_hidden_raises_drop_not_open(db_session) -> None:
    _, org = await _pending_org(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    drop.hidden_at = datetime.now(timezone.utc)
    await db_session.flush()
    with pytest.raises(BuzzAPIException) as exc:
        await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop.id, pitch=None)
    assert exc.value.code == errors.DROP_NOT_OPEN


async def test_upsert_reopens_expired_when_drop_open_again(db_session) -> None:
    _, org = await _pending_org(db_session)
    brand = await make_brand(db_session)
    now = datetime.now(timezone.utc)
    drop = await make_drop(
        db_session,
        brand,
        apply_open_at=now - timedelta(days=8),
        apply_close_at=now - timedelta(days=1),
    )
    first = await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop.id, pitch="v1")
    assert first.status == DropApplyIntentStatus.EXPIRED.value

    drop.apply_close_at = now + timedelta(days=3)
    drop.manual_reopen = True
    await db_session.flush()
    second = await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop.id, pitch="v2")
    assert second.id == first.id
    assert second.status == DropApplyIntentStatus.OPEN.value
    assert second.pitch == "v2"


async def test_promoted_intent_is_not_reopened(db_session) -> None:
    user, org = await _pending_org(db_session, status=OrgUserStatus.ACTIVE)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    intent = await record_drop_apply_intent(
        db_session, org_id=org.id, drop_id=drop.id, pitch="keep"
    )
    await promote_drop_apply_intents(db_session, user)
    await db_session.refresh(intent)
    assert intent.status == DropApplyIntentStatus.PROMOTED.value

    again = await record_drop_apply_intent(
        db_session, org_id=org.id, drop_id=drop.id, pitch="changed"
    )
    assert again.status == DropApplyIntentStatus.PROMOTED.value
    assert again.pitch == "keep"


async def test_unique_org_drop_constraint(db_session) -> None:
    _, org = await _pending_org(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop.id, pitch=None)
    db_session.add(
        DropApplyIntent(
            org_id=org.id,
            drop_id=drop.id,
            status=DropApplyIntentStatus.OPEN.value,
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_promote_writes_application_and_marks_promoted(db_session) -> None:
    user, org = await _pending_org(db_session, status=OrgUserStatus.ACTIVE)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop.id, pitch="hello")
    await promote_drop_apply_intents(db_session, user)
    app = await db_session.scalar(
        select(DropApplication).where(
            DropApplication.org_id == org.id, DropApplication.drop_id == drop.id
        )
    )
    assert app is not None
    assert app.decision == ApplicationDecision.APPLIED.value
    assert app.pitch == "hello"
    intent = await db_session.scalar(
        select(DropApplyIntent).where(DropApplyIntent.org_id == org.id)
    )
    assert intent is not None
    assert intent.status == DropApplyIntentStatus.PROMOTED.value


async def test_promote_already_applied_is_noop_promoted(db_session) -> None:
    user, org = await _pending_org(db_session, status=OrgUserStatus.ACTIVE)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    await make_application(db_session, drop, org, pitch="existing")
    await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop.id, pitch="intent")
    await promote_drop_apply_intents(db_session, user)
    apps = list(
        await db_session.scalars(
            select(DropApplication).where(
                DropApplication.org_id == org.id,
                DropApplication.drop_id == drop.id,
                DropApplication.decision != ApplicationDecision.DENIED.value,
            )
        )
    )
    assert len(apps) == 1
    assert apps[0].pitch == "existing"
    intent = await db_session.scalar(
        select(DropApplyIntent).where(DropApplyIntent.org_id == org.id)
    )
    assert intent is not None
    assert intent.status == DropApplyIntentStatus.PROMOTED.value


async def test_promote_closed_drop_expires_without_application(db_session) -> None:
    user, org = await _pending_org(db_session, status=OrgUserStatus.ACTIVE)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    intent = await record_drop_apply_intent(
        db_session, org_id=org.id, drop_id=drop.id, pitch="soon"
    )
    now = datetime.now(timezone.utc)
    drop.apply_close_at = now - timedelta(hours=1)
    drop.apply_open_at = now - timedelta(days=8)
    drop.manual_reopen = False
    await db_session.flush()
    await promote_drop_apply_intents(db_session, user)
    await db_session.refresh(intent)
    assert intent.status == DropApplyIntentStatus.EXPIRED.value
    assert (
        await db_session.scalar(
            select(DropApplication.id).where(DropApplication.drop_id == drop.id)
        )
        is None
    )


async def test_promote_all_open_intents_across_drops(db_session) -> None:
    user, org = await _pending_org(db_session, status=OrgUserStatus.ACTIVE)
    brand = await make_brand(db_session)
    drop_a = await make_drop(db_session, brand, title="A")
    drop_b = await make_drop(db_session, brand, title="B")
    await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop_a.id, pitch="a")
    await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop_b.id, pitch="b")
    await promote_drop_apply_intents(db_session, user)
    apps = list(
        await db_session.scalars(select(DropApplication).where(DropApplication.org_id == org.id))
    )
    assert {app.drop_id for app in apps} == {drop_a.id, drop_b.id}


async def test_lazy_expire_when_window_closes(db_session) -> None:
    _, org = await _pending_org(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop.id, pitch=None)
    now = datetime.now(timezone.utc)
    drop.apply_close_at = now - timedelta(hours=1)
    drop.apply_open_at = now - timedelta(days=8)
    await db_session.flush()
    await expire_stale_intents_for_drop(db_session, drop)
    intent = await get_intent_for_org_drop(db_session, org_id=org.id, drop_id=drop.id)
    assert intent is not None
    assert intent.status == DropApplyIntentStatus.EXPIRED.value


async def test_list_intents_omits_promoted(db_session) -> None:
    user, org = await _pending_org(db_session, status=OrgUserStatus.ACTIVE)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop.id, pitch="x")
    await promote_drop_apply_intents(db_session, user)
    assert await list_intents_for_drop(db_session, drop) == []


async def test_connect_promotes_open_intent(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    fake_instagram.user_id = "ig_intent_bind"
    fake_instagram.username = "campusgreeks"
    user = await persist(
        db_session,
        make_user(
            role=PortalRole.ORG,
            status=OrgUserStatus.PENDING_INSTAGRAM,
            instagram_user_id=None,
            instagram_username="campusgreeks",
        ),
    )
    org = await make_org(db_session, user)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop.id, pitch="from page")

    token = mint_access_token(user)
    start = await app_client.post(
        "/api/auth/instagram/bind-start",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert start.status_code == 200
    state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "bind-code", "state": state},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["user"]["status"] == "active"

    app = await db_session.scalar(
        select(DropApplication).where(
            DropApplication.org_id == org.id, DropApplication.drop_id == drop.id
        )
    )
    assert app is not None
    assert app.pitch == "from page"


async def test_connect_succeeds_when_drop_no_longer_open(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    fake_instagram.user_id = "ig_intent_closed"
    fake_instagram.username = "closedclub"
    user = await persist(
        db_session,
        make_user(
            role=PortalRole.ORG,
            status=OrgUserStatus.PENDING_INSTAGRAM,
            instagram_user_id=None,
            instagram_username="closedclub",
        ),
    )
    org = await make_org(db_session, user)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    intent = await record_drop_apply_intent(
        db_session, org_id=org.id, drop_id=drop.id, pitch="too late"
    )
    now = datetime.now(timezone.utc)
    drop.apply_close_at = now - timedelta(hours=1)
    drop.apply_open_at = now - timedelta(days=8)
    await db_session.flush()

    token = mint_access_token(user)
    start = await app_client.post(
        "/api/auth/instagram/bind-start",
        headers={"Authorization": f"Bearer {token}"},
    )
    state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "bind-code", "state": state},
    )
    assert resp.status_code == 200
    await db_session.refresh(intent)
    assert intent.status == DropApplyIntentStatus.EXPIRED.value
    assert (
        await db_session.scalar(
            select(DropApplication.id).where(DropApplication.drop_id == drop.id)
        )
        is None
    )


async def test_approve_skip_connect_promotes(app_client: AsyncClient, db_session) -> None:
    user = await persist(
        db_session,
        make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_APPROVAL),
    )
    user.instagram_user_id = "ig_already"
    user.instagram_access_token = "enc-token"
    org = await make_org(db_session, user)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    await record_drop_apply_intent(db_session, org_id=org.id, drop_id=drop.id, pitch="skip")

    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    res = await app_client.post(
        f"/api/admin/orgs/{org.id}/approve",
        headers={"Authorization": f"Bearer {mint_access_token(admin)}"},
        json={"testerInviteConfirmed": True},
    )
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "active"
    app = await db_session.scalar(select(DropApplication).where(DropApplication.org_id == org.id))
    assert app is not None
    assert app.pitch == "skip"


async def test_deny_expires_open_intent(app_client: AsyncClient, db_session) -> None:
    user = await persist(
        db_session,
        make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_APPROVAL),
    )
    org = await make_org(db_session, user)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    intent = await record_drop_apply_intent(
        db_session, org_id=org.id, drop_id=drop.id, pitch="please"
    )
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    res = await app_client.post(
        f"/api/admin/orgs/{org.id}/deny",
        headers={"Authorization": f"Bearer {mint_access_token(admin)}"},
    )
    assert res.status_code == 200
    await db_session.refresh(intent)
    assert intent.status == DropApplyIntentStatus.EXPIRED.value
    assert intent.pitch == "please"


async def test_erase_expires_and_clears_pitch(
    app_client: AsyncClient, db_session, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.services.admin_erase.send_org_erased_email", AsyncMock(return_value=True)
    )
    user = await persist(db_session, make_user(role=PortalRole.ORG, status=OrgUserStatus.ACTIVE))
    user.instagram_username = "CampusGreeks"
    user.edu_email = "greeks@school.edu"
    org = await make_org(db_session, user)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    intent = await record_drop_apply_intent(
        db_session, org_id=org.id, drop_id=drop.id, pitch="secret pitch"
    )
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    res = await app_client.post(
        f"/api/admin/orgs/{user.id}/erase",
        headers={"Authorization": f"Bearer {mint_access_token(admin)}"},
        json={"confirm": "@CampusGreeks"},
    )
    assert res.status_code == 200
    await db_session.refresh(intent)
    assert intent.status == DropApplyIntentStatus.EXPIRED.value
    assert intent.pitch is None
    still = await db_session.get(DropApplyIntent, intent.id)
    assert still is not None
