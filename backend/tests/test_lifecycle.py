"""Drop lifecycle end to end, plus the stage helper and its time windows.

The stage is computed (``app.services.lifecycle``); these tests walk one drop
through every stage via the real routes, then pin the edge rules: unsent
decisions stay private, orgs link until the grace ends, BUZZ always can.
"""

from __future__ import annotations

from datetime import timedelta

from httpx import AsyncClient
from sqlalchemy import select

from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.enums import ApplicationDecision, DropStage, PortalRole
from app.security import jwt
from app.services.lifecycle import (
    METRIC_SYNC_AFTER_WRAP,
    ORG_LINK_GRACE,
    autolink_open,
    drop_stage,
    metrics_sync_open,
)
from app.timeutils import utcnow
from tests.conftest import (
    admin_headers,
    make_application,
    make_brand,
    make_drop,
    make_org,
    make_social_post,
    make_user,
    mint_access_token,
    persist,
)


def _bearer(user) -> dict[str, str]:
    return {"Authorization": f"Bearer {mint_access_token(user)}"}


async def _org(db_session, name: str):
    user = await persist(db_session, make_user())
    org = await make_org(db_session, user, org_name=name)
    return user, org


def _ms(dt) -> int:
    return int(dt.timestamp() * 1000)


async def test_full_lifecycle(app_client: AsyncClient, db_session) -> None:
    admin = await admin_headers(db_session)
    brand_user = await persist(db_session, make_user(role=PortalRole.BRAND))
    brand = await make_brand(db_session, company_email="lifecycle-brand@example.test")
    brand.user_id = brand_user.id
    now = utcnow()
    picked_user, picked = await _org(db_session, "Picked")
    passed_user, passed = await _org(db_session, "Passed")
    _, retro = await _org(db_session, "Retro")
    brand_h = _bearer(brand_user)

    # Brand requests a campaign; BUZZ turns the ticket into a draft drop.
    res = await app_client.post(
        "/api/brands/me/drop-requests",
        json={"message": "Sample our new snack", "product": "Snack box", "orgCount": 1},
        headers=brand_h,
    )
    assert res.status_code == 200, res.text
    ticket_id = res.json()["data"]["id"]
    res = await app_client.post(
        f"/api/admin/brands/{brand.id}/drops",
        json={
            "title": "Snack drop",
            "description": "Try it, post it.",
            "image": "https://example.test/snack.png",
            "location": "Campus",
            "capacityTotal": 1,
            "applyOpenAt": _ms(now - timedelta(days=1)),
            "applyCloseAt": _ms(now + timedelta(days=7)),
            "dropRequestId": ticket_id,
        },
        headers=admin,
    )
    assert res.status_code == 200, res.text
    assert res.json()["data"]["stage"] == "draft"
    drop = await db_session.get(Drop, res.json()["data"]["id"])
    assert drop is not None
    assert await drop_stage(db_session, drop) == DropStage.DRAFT
    res = await app_client.get(f"/api/admin/drop-requests/{ticket_id}", headers=admin)
    assert res.json()["data"]["convertedDropId"] == str(drop.id)

    # Draft → Applying (publish inside the window).
    res = await app_client.post(f"/api/admin/drops/{drop.id}/publish", headers=admin)
    assert res.status_code == 200, res.text
    assert res.json()["data"]["stage"] == "applying"

    # Orgs apply.
    seats = {}
    for user, org in ((picked_user, picked), (passed_user, passed)):
        res = await app_client.post(f"/api/drops/{drop.id}/apply", headers=_bearer(user), json={})
        assert res.status_code == 200, res.text
        seats[org.id] = res.json()["data"]["id"]

    # Close the window → Selecting.
    res = await app_client.patch(
        f"/api/admin/drops/{drop.id}",
        json={"applyCloseAt": _ms(utcnow() - timedelta(minutes=1))},
        headers=admin,
    )
    assert res.status_code == 200, res.text
    assert res.json()["data"]["stage"] == "selecting"

    # Brand decides per seat; nothing is visible to orgs until sent.
    for org, decision in ((picked, "accepted"), (passed, "denied")):
        res = await app_client.put(
            f"/api/brands/me/drops/{drop.id}/applications/{seats[org.id]}/decision",
            json={"decision": decision},
            headers=brand_h,
        )
        assert res.status_code == 200, res.text
    res = await app_client.get(f"/api/campaigns/{seats[picked.id]}", headers=_bearer(picked_user))
    assert res.json()["data"]["decision"] == "applied"

    # Send → Live. The denial disappears from the passed org's list.
    res = await app_client.post(f"/api/brands/me/drops/{drop.id}/send-decisions", headers=brand_h)
    assert res.json()["data"] == {"acceptedCount": 1, "deniedCount": 1}
    res = await app_client.get(f"/api/campaigns/{seats[picked.id]}", headers=_bearer(picked_user))
    assert res.json()["data"]["decision"] == "accepted"
    assert res.json()["data"]["stage"] == "live"
    assert (await app_client.get("/api/campaigns", headers=_bearer(passed_user))).json()[
        "data"
    ] == []

    # Wrap → Wrapped. The org can still link inside the grace period.
    res = await app_client.post(f"/api/admin/drops/{drop.id}/wrap", headers=admin)
    assert res.json()["data"]["stage"] == "wrapped"
    post = await make_social_post(db_session, picked)
    res = await app_client.post(
        f"/api/campaigns/{seats[picked.id]}/link-post",
        json={"postId": str(post.id)},
        headers=_bearer(picked_user),
    )
    assert res.status_code == 200, res.text

    # Retro: BUZZ seats another org after wrap; it is live at once.
    res = await app_client.post(
        f"/api/admin/drops/{drop.id}/add-org", json={"orgId": str(retro.id)}, headers=admin
    )
    assert res.status_code == 200, res.text
    row = await db_session.get(DropApplication, res.json()["data"]["applicationId"])
    assert row is not None
    assert row.decision == ApplicationDecision.ACCEPTED.value
    assert row.decision_sent_at is not None

    # Unwrap returns to the computed stage.
    res = await app_client.post(f"/api/admin/drops/{drop.id}/unwrap", headers=admin)
    assert res.json()["data"]["stage"] == "live"


async def test_stage_helper_each_stage(db_session) -> None:
    brand = await make_brand(db_session)
    _, org = await _org(db_session, "Seat")
    now = utcnow()
    closed = {"apply_open_at": now - timedelta(days=9), "apply_close_at": now - timedelta(days=1)}
    cases: list[tuple[DropStage, Drop]] = [
        (DropStage.DRAFT, await make_drop(db_session, brand, published_at=None)),
        (
            DropStage.UPCOMING,
            await make_drop(
                db_session,
                brand,
                apply_open_at=now + timedelta(days=1),
                apply_close_at=now + timedelta(days=8),
            ),
        ),
        (DropStage.APPLYING, await make_drop(db_session, brand)),
        (DropStage.SELECTING, await make_drop(db_session, brand, **closed)),
        (DropStage.WRAPPED, await make_drop(db_session, brand, wrapped_at=now, **closed)),
    ]
    live = await make_drop(db_session, brand, **closed)
    await make_application(db_session, live, org, decision=ApplicationDecision.ACCEPTED)
    cases.append((DropStage.LIVE, live))
    # An unsent acceptance does not make a drop live.
    unsent = await make_drop(db_session, brand, **closed)
    await make_application(
        db_session, unsent, org, decision=ApplicationDecision.ACCEPTED, sent=False
    )
    cases.append((DropStage.SELECTING, unsent))
    for expected, drop in cases:
        assert await drop_stage(db_session, drop) == expected, drop.title


async def test_job_windows_after_wrap(db_session) -> None:
    brand = await make_brand(db_session)
    now = utcnow()
    recent = await make_drop(db_session, brand, wrapped_at=now - ORG_LINK_GRACE + timedelta(days=1))
    mid = await make_drop(db_session, brand, wrapped_at=now - ORG_LINK_GRACE - timedelta(days=1))
    old = await make_drop(
        db_session, brand, wrapped_at=now - METRIC_SYNC_AFTER_WRAP - timedelta(days=1)
    )
    ids = [recent.id, mid.id, old.id]

    async def _open(clause) -> set:
        return set(await db_session.scalars(select(Drop.id).where(Drop.id.in_(ids), clause)))

    assert await _open(autolink_open()) == {recent.id}
    assert await _open(metrics_sync_open()) == {recent.id, mid.id}


async def test_org_link_closes_after_grace_but_buzz_can_link(
    app_client: AsyncClient, db_session
) -> None:
    user, org = await _org(db_session, "Late")
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, wrapped_at=utcnow() - ORG_LINK_GRACE)
    seat = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
    post = await make_social_post(db_session, org)
    url = f"/api/campaigns/{seat.id}/link-post"
    body = {"postId": str(post.id)}
    res = await app_client.post(url, json=body, headers=_bearer(user))
    assert res.status_code == 400
    listed = (await app_client.get("/api/campaigns", headers=_bearer(user))).json()["data"]
    assert listed[0]["linksOpen"] is False

    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    token = jwt.create_access_token(
        user.id,
        user.portal_role,
        user.status,
        token_version=user.token_version or 0,
        impersonated_by=admin.id,
        impersonator_token_version=admin.token_version or 0,
        readonly=False,
    )
    res = await app_client.post(url, json=body, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text

