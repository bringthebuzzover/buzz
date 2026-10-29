"""Drop lifecycle end to end, plus the stage helper and its time windows.

The stage is computed (``app.services.lifecycle``); these tests walk one drop
through every stage via the real routes, then pin the edge rules: unsent
decisions stay private, orgs link until the grace ends, BUZZ always can,
seats end (withdraw / remove), delivery is per seat, and cancel freezes a drop.
"""

from __future__ import annotations

from datetime import timedelta

from httpx import AsyncClient
from sqlalchemy import select

from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.enums import ApplicationDecision, DropStage, PortalRole
from app.models.shipment import DropApplicationShipment
from app.security import jwt
from app.services.admin_read import _signal_counts
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
    make_post_link,
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
    canceled = await make_drop(db_session, brand, **closed)
    canceled.canceled_at = now
    await make_application(db_session, canceled, org, decision=ApplicationDecision.ACCEPTED)
    cases.append((DropStage.CANCELED, canceled))
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


async def test_org_withdraws_until_shipped(app_client: AsyncClient, db_session) -> None:
    admin = await admin_headers(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    user, org = await _org(db_session, "Leaver")
    h = _bearer(user)

    # An applicant withdraws, disappears from its list, and may apply again.
    seat = await make_application(db_session, drop, org)
    res = await app_client.post(f"/api/campaigns/{seat.id}/withdraw", headers=h)
    assert res.status_code == 200, res.text
    await db_session.refresh(seat)
    assert seat.decision == ApplicationDecision.WITHDREW.value
    assert seat.decision_sent_at is not None
    assert (await app_client.get("/api/campaigns", headers=h)).json()["data"] == []
    res = await app_client.post(f"/api/drops/{drop.id}/apply", headers=h, json={})
    assert res.status_code == 200, res.text
    again = await db_session.get(DropApplication, res.json()["data"]["id"])
    assert again is not None

    # Accepted and unshipped: still free to leave; units are released.
    again.decision = ApplicationDecision.ACCEPTED.value
    again.allocated_units = 3
    again.decision_sent_at = utcnow()
    await db_session.flush()
    res = await app_client.post(f"/api/campaigns/{again.id}/withdraw", headers=h)
    assert res.status_code == 200, res.text
    await db_session.refresh(again)
    assert again.allocated_units is None

    # Once a package ships, only BUZZ can end the seat.
    shipped = await make_application(
        db_session, await make_drop(db_session, brand), org, decision=ApplicationDecision.ACCEPTED
    )
    res = await app_client.post(
        f"/api/admin/applications/{shipped.id}/shipments",
        json={"trackingNumber": "1Z999"},
        headers=admin,
    )
    assert res.status_code == 200, res.text
    res = await app_client.post(f"/api/campaigns/{shipped.id}/withdraw", headers=h)
    assert res.status_code == 409


async def test_buzz_removes_with_reason_and_blocks_reapply(
    app_client: AsyncClient, db_session
) -> None:
    admin = await admin_headers(db_session)
    brand_user = await persist(db_session, make_user(role=PortalRole.BRAND))
    brand = await make_brand(db_session, company_email="remove-brand@example.test")
    brand.user_id = brand_user.id
    drop = await make_drop(db_session, brand)
    user, org = await _org(db_session, "Gone")
    seat = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
    url = f"/api/admin/drops/{drop.id}/applications/{seat.id}/decision"

    res = await app_client.put(url, json={"decision": "removed"}, headers=admin)
    assert res.status_code == 400
    res = await app_client.put(
        f"/api/brands/me/drops/{drop.id}/applications/{seat.id}/decision",
        json={"decision": "removed"},
        headers=_bearer(brand_user),
    )
    assert res.status_code == 422  # brands choose only accepted / denied
    res = await app_client.put(
        url, json={"decision": "removed", "reason": "No posts after two reminders"}, headers=admin
    )
    assert res.status_code == 200, res.text
    await db_session.refresh(seat)
    assert seat.decision == ApplicationDecision.REMOVED.value
    assert seat.end_reason == "No posts after two reminders"

    # An ended seat is final: no re-decision, no second end (late-add instead).
    for body in ({"decision": "accepted"}, {"decision": "withdrew"}):
        res = await app_client.put(url, json=body, headers=admin)
        assert res.status_code == 400, res.text
        assert res.json()["error"]["code"] == "DECISION_ALREADY_SENT"
    await db_session.refresh(seat)
    assert seat.decision == ApplicationDecision.REMOVED.value

    h = _bearer(user)
    assert (await app_client.get(f"/api/campaigns/{seat.id}", headers=h)).status_code == 404
    res = await app_client.post(f"/api/drops/{drop.id}/apply", headers=h, json={})
    assert res.status_code == 400  # already applied: a removed seat stays taken

    # BUZZ can bring the seat back with a late add.
    res = await app_client.post(
        f"/api/admin/drops/{drop.id}/add-org", json={"orgId": str(org.id)}, headers=admin
    )
    assert res.status_code == 200, res.text
    await db_session.refresh(seat)
    assert seat.decision == ApplicationDecision.ACCEPTED.value
    assert seat.end_reason is None
    assert seat.decision_sent_at is not None  # late-add is sent, not a draft


async def test_delivered_per_seat(app_client: AsyncClient, db_session) -> None:
    admin = await admin_headers(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand)
    user, org = await _org(db_session, "Mailroom")
    h = _bearer(user)
    draft = await make_application(
        db_session, drop, org, decision=ApplicationDecision.ACCEPTED, sent=False
    )
    res = await app_client.put(
        f"/api/admin/applications/{draft.id}/delivered", json={"delivered": True}, headers=admin
    )
    assert res.status_code == 400  # not live until the acceptance is sent

    seat = await make_application(
        db_session, await make_drop(db_session, brand), org, decision=ApplicationDecision.ACCEPTED
    )
    res = await app_client.put(
        f"/api/campaigns/{seat.id}/delivered", json={"delivered": True}, headers=h
    )
    assert res.status_code == 200, res.text
    assert (await app_client.get(f"/api/campaigns/{seat.id}", headers=h)).json()["data"][
        "deliveredAt"
    ] is not None
    res = await app_client.put(
        f"/api/admin/applications/{seat.id}/delivered", json={"delivered": False}, headers=admin
    )
    assert res.status_code == 200, res.text
    await db_session.refresh(seat)
    assert seat.delivered_at is None


async def test_cancel_needs_title_and_freezes_drop(app_client: AsyncClient, db_session) -> None:
    admin = await admin_headers(db_session)
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, title="Spring Socks")
    user, org = await _org(db_session, "Canceled")
    seat = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
    url = f"/api/admin/drops/{drop.id}/cancel"

    res = await app_client.post(url, json={"confirm": "spring"}, headers=admin)
    assert res.status_code == 400
    res = await app_client.post(url, json={"confirm": "Spring Socks"}, headers=admin)
    assert res.status_code == 200, res.text
    assert res.json()["data"]["stage"] == "canceled"
    assert await drop_stage(db_session, drop) == DropStage.CANCELED
    res = await app_client.post(url, json={"confirm": "Spring Socks"}, headers=admin)
    assert res.status_code == 409

    # Frozen: no wrap, tracking, links, applies, or decisions.
    blocked = [
        await app_client.post(f"/api/admin/drops/{drop.id}/wrap", headers=admin),
        await app_client.post(
            f"/api/admin/applications/{seat.id}/shipments",
            json={"trackingNumber": "1Z1"},
            headers=admin,
        ),
        await app_client.put(
            f"/api/admin/drops/{drop.id}/applications/{seat.id}/decision",
            json={"decision": "denied"},
            headers=admin,
        ),
    ]
    assert [r.status_code for r in blocked] == [409, 409, 409]
    post = await make_social_post(db_session, org)
    res = await app_client.post(
        f"/api/campaigns/{seat.id}/link-post",
        json={"postId": str(post.id)},
        headers=_bearer(user),
    )
    assert res.status_code == 409
    _, other = await _org(db_session, "Late")
    res = await app_client.post(
        f"/api/admin/drops/{drop.id}/add-org", json={"orgId": str(other.id)}, headers=admin
    )
    assert res.status_code == 409

    # BUZZ can still end a seat (to record why it never happened).
    res = await app_client.put(
        f"/api/admin/drops/{drop.id}/applications/{seat.id}/decision",
        json={"decision": "removed", "reason": "Drop canceled"},
        headers=admin,
    )
    assert res.status_code == 200, res.text


async def test_cancel_only_running_drops(app_client: AsyncClient, db_session) -> None:
    admin = await admin_headers(db_session)
    brand = await make_brand(db_session)
    for drop in (
        await make_drop(db_session, brand, title="Draft", published_at=None),
        await make_drop(db_session, brand, title="Done", wrapped_at=utcnow()),
    ):
        res = await app_client.post(
            f"/api/admin/drops/{drop.id}/cancel", json={"confirm": drop.title}, headers=admin
        )
        assert res.status_code in (400, 409), drop.title


async def test_shipped_no_delivery_signal(db_session) -> None:
    brand = await make_brand(db_session)
    _, org = await _org(db_session, "Lost Box")
    seat = await make_application(
        db_session, await make_drop(db_session, brand), org, decision=ApplicationDecision.ACCEPTED
    )
    before = (await _signal_counts(db_session, utcnow()))["shipped_no_delivery"]
    db_session.add(
        DropApplicationShipment(
            application_id=seat.id,
            tracking_number="1Z-old",
            carrier="ups",
            created_at=utcnow() - timedelta(days=15),
        )
    )
    await db_session.flush()
    assert (await _signal_counts(db_session, utcnow()))["shipped_no_delivery"] == before + 1
    seat.delivered_at = utcnow()
    await db_session.flush()
    assert (await _signal_counts(db_session, utcnow()))["shipped_no_delivery"] == before


async def test_seat_progress_on_every_surface(app_client: AsyncClient, db_session) -> None:
    admin = await admin_headers(db_session)
    brand_user = await persist(db_session, make_user(role=PortalRole.BRAND))
    brand = await make_brand(db_session, company_email="progress-brand@example.test")
    brand.user_id = brand_user.id
    drop = await make_drop(db_session, brand)
    user, org = await _org(db_session, "Progress")
    seat = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
    _, waiting = await _org(db_session, "Waiting")
    await make_application(db_session, drop, waiting, decision=ApplicationDecision.APPLIED)

    async def progress() -> tuple[object, object]:
        admin_rows = (await app_client.get(f"/api/admin/drops/{drop.id}", headers=admin)).json()[
            "data"
        ]["applicants"]
        brand_rows = (
            await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=_bearer(brand_user))
        ).json()["data"]["applications"]
        org_row = (await app_client.get("/api/campaigns", headers=_bearer(user))).json()["data"][0]
        by_id = {r["id"]: r["progress"] for r in admin_rows}
        assert {r["id"]: r["progress"] for r in brand_rows} == by_id
        assert None in by_id.values()  # the undecided applicant has no progress
        return by_id[str(seat.id)], org_row["progress"]

    assert await progress() == ("accepted", "accepted")
    db_session.add(
        DropApplicationShipment(application_id=seat.id, tracking_number="1Z", carrier="ups")
    )
    await db_session.flush()
    assert await progress() == ("shipped", "shipped")
    seat.delivered_at = utcnow()
    await db_session.flush()
    assert await progress() == ("delivered", "delivered")
    await make_post_link(db_session, await make_social_post(db_session, org), seat)
    assert await progress() == ("posted", "posted")


async def test_brand_totals_skip_drafts_and_unsent_seats(
    app_client: AsyncClient, db_session
) -> None:
    brand_user = await persist(db_session, make_user(role=PortalRole.BRAND))
    brand = await make_brand(db_session, company_email="totals-brand@example.test")
    brand.user_id = brand_user.id
    live = await make_drop(db_session, brand)
    draft = await make_drop(db_session, brand, published_at=None)
    _, sent = await _org(db_session, "Sent")
    _, drafted = await _org(db_session, "Drafted")
    await make_application(db_session, live, sent, decision=ApplicationDecision.ACCEPTED)
    await make_application(
        db_session, live, drafted, decision=ApplicationDecision.ACCEPTED, sent=False
    )
    await make_application(db_session, draft, sent, decision=ApplicationDecision.ACCEPTED)

    res = await app_client.get("/api/brands/me/aggregate", headers=_bearer(brand_user))
    data = res.json()["data"]
    assert data["totalDrops"] == 1
    assert data["totalOrgs"] == 1


async def test_overview_counts_drops_by_stage(app_client: AsyncClient, db_session) -> None:
    admin = await admin_headers(db_session)
    before = {
        row["stage"]: row["count"]
        for row in (await app_client.get("/api/admin/overview", headers=admin)).json()["data"][
            "stages"
        ]
    }
    brand = await make_brand(db_session)
    await make_drop(db_session, brand, published_at=None)
    await make_drop(db_session, brand)
    res = await app_client.get("/api/admin/overview", headers=admin)
    after = {row["stage"]: row["count"] for row in res.json()["data"]["stages"]}
    assert list(after) == [stage.value for stage in DropStage]
    assert after["draft"] == before["draft"] + 1
    assert after["applying"] == before["applying"] + 1


async def _closed_drop_with_live_seat(db_session):
    brand = await make_brand(db_session)
    now = utcnow()
    drop = await make_drop(
        db_session,
        brand,
        apply_open_at=now - timedelta(days=3),
        apply_close_at=now - timedelta(days=1),
        total_product_units=10,
    )
    _, org = await _org(db_session, "Live")
    seat = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
    seat.allocated_units = 2
    await db_session.flush()
    return drop, seat


async def test_units_change_keeps_a_sent_seat_live(app_client: AsyncClient, db_session) -> None:
    drop, seat = await _closed_drop_with_live_seat(db_session)
    sent_at = seat.decision_sent_at
    res = await app_client.put(
        f"/api/admin/drops/{drop.id}/applications/{seat.id}/decision",
        json={"decision": "accepted", "allocatedUnits": 4},
        headers=await admin_headers(db_session),
    )
    assert res.status_code == 200, res.text
    await db_session.refresh(seat)
    assert seat.allocated_units == 4
    assert seat.decision_sent_at == sent_at
    assert await drop_stage(db_session, drop) == DropStage.LIVE


async def test_sent_decision_only_moves_forward_to_accepted(
    app_client: AsyncClient, db_session
) -> None:
    drop, live = await _closed_drop_with_live_seat(db_session)
    _, org = await _org(db_session, "Told no")
    denied = await make_application(db_session, drop, org, decision=ApplicationDecision.DENIED)
    admin = await admin_headers(db_session)

    def url(seat) -> str:
        return f"/api/admin/drops/{drop.id}/applications/{seat.id}/decision"

    # A live seat can't be re-decided (removal is the way out); nor can a
    # sent denial go back to undecided.
    for seat, decision in ((live, "denied"), (live, "applied"), (denied, "applied")):
        res = await app_client.put(url(seat), json={"decision": decision}, headers=admin)
        assert res.json()["error"]["code"] == "DECISION_ALREADY_SENT", (seat.id, decision)

    # BUZZ reverses the denial; it waits for the next send.
    res = await app_client.put(
        url(denied), json={"decision": "accepted", "allocatedUnits": 1}, headers=admin
    )
    assert res.status_code == 200, res.text
    await db_session.refresh(denied)
    assert denied.decision == ApplicationDecision.ACCEPTED.value
    assert denied.decision_sent_at is None


async def test_no_decisions_or_sends_on_a_hidden_drop(app_client: AsyncClient, db_session) -> None:
    drop, seat = await _closed_drop_with_live_seat(db_session)
    drop.hidden_at = utcnow()
    await db_session.flush()
    admin = await admin_headers(db_session)
    res = await app_client.put(
        f"/api/admin/drops/{drop.id}/applications/{seat.id}/decision",
        json={"decision": "accepted", "allocatedUnits": 3},
        headers=admin,
    )
    assert res.json()["error"]["code"] == "DROP_HIDDEN"
    res = await app_client.post(f"/api/admin/drops/{drop.id}/send-decisions", headers=admin)
    assert res.json()["error"]["code"] == "DROP_HIDDEN"
