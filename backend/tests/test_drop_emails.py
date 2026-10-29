"""Drop lifecycle emails (plan §3.6): who hears what, once.

Both senders in ``app.services.drop_notices`` are replaced by a recorder, so
each test reads (kind, to, subject) for every email a step would send.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from httpx import AsyncClient

from app.jobs.notify_reminders import send_due_reminders
from app.models.brand import Brand
from app.models.enums import ApplicationDecision
from app.services import drop_notices
from app.timeutils import utcnow
from tests.conftest import (
    admin_headers,
    make_application,
    make_brand,
    make_drop,
    make_org,
    make_user,
    mint_access_token,
    persist,
)

BRAND = "notices-brand@example.test"


@pytest.fixture
def sent(monkeypatch) -> list[tuple[str, str, str, list[str] | None]]:
    """(kind, to, subject, cc) for every email sent, in order."""

    out: list[tuple[str, str, str, list[str] | None]] = []

    async def lifecycle(to, *, subject, idempotency_key=None, cc=None, **_):
        out.append((str(idempotency_key).split("/")[0], to, subject, cc))
        return True

    async def denied(to, *, idempotency_key=None, **_):
        out.append((str(idempotency_key).split("/")[0], to, "not selected", None))
        return True

    monkeypatch.setattr(drop_notices, "send_lifecycle_email", lifecycle)
    monkeypatch.setattr(drop_notices, "send_application_denied_email", denied)
    return out


async def _org(db_session, name: str):
    user = make_user()
    user.edu_email = f"{name.lower()}@example.edu"
    await persist(db_session, user)
    return user, await make_org(db_session, user, org_name=name)


async def _closed_drop(db_session, *, closed_ago=timedelta(hours=1), brand=None):
    brand = brand or await make_brand(db_session, company_email=BRAND)
    now = utcnow()
    return await make_drop(
        db_session,
        brand,
        title="Snack drop",
        apply_open_at=now - timedelta(days=10),
        apply_close_at=now - closed_ago,
    )


def _kinds(sent) -> list[tuple[str, str]]:
    return [(kind, to) for kind, to, _, _ in sent]


async def test_send_decisions_emails_each_org_once(
    app_client: AsyncClient, db_session, sent
) -> None:
    admin = await admin_headers(db_session)
    drop = await _closed_drop(db_session)
    _, yes = await _org(db_session, "Yes")
    _, no = await _org(db_session, "No")
    _, wait = await _org(db_session, "Wait")
    await make_application(db_session, drop, yes, decision=ApplicationDecision.ACCEPTED, sent=False)
    await make_application(db_session, drop, no, decision=ApplicationDecision.DENIED, sent=False)
    await make_application(db_session, drop, wait)

    res = await app_client.post(f"/api/admin/drops/{drop.id}/send-decisions", headers=admin)
    assert res.status_code == 200, res.text
    assert sorted(_kinds(sent)) == [
        ("application-denied", "no@example.edu"),
        ("seat-accepted", "yes@example.edu"),
    ]
    assert "Good news" in next(s for k, _, s, _ in sent if k == "seat-accepted")

    # A second send has nothing new; the brand never got a per-seat email.
    sent.clear()
    await app_client.post(f"/api/admin/drops/{drop.id}/send-decisions", headers=admin)
    assert sent == []


async def test_shipment_and_withdraw_notices(app_client: AsyncClient, db_session, sent) -> None:
    admin = await admin_headers(db_session)
    drop = await _closed_drop(db_session)
    user, org = await _org(db_session, "Ship")
    seat = await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)

    res = await app_client.post(
        f"/api/admin/applications/{seat.id}/shipments",
        json={"trackingNumber": "1Z999AA10123456784"},
        headers=admin,
    )
    assert res.status_code == 200, res.text
    assert _kinds(sent) == [("seat-shipped", "ship@example.edu")]

    _, leaver = await _org(db_session, "Leaver")
    left = await make_application(db_session, drop, leaver, decision=ApplicationDecision.ACCEPTED)
    sent.clear()
    leaver_user = await db_session.get(type(user), leaver.user_id)
    res = await app_client.post(
        f"/api/campaigns/{left.id}/withdraw",
        headers={"Authorization": f"Bearer {mint_access_token(leaver_user)}"},
    )
    assert res.status_code == 200, res.text
    kinds = [k for k, _ in _kinds(sent)]
    assert kinds == ["seat-withdrew", "seat-withdrew-ops"]
    assert BRAND not in [to for _, to in _kinds(sent)]


async def test_wrap_sends_not_selected_thanks_and_recap(
    app_client: AsyncClient, db_session, sent
) -> None:
    admin = await admin_headers(db_session)
    drop = await _closed_drop(db_session)
    _, live = await _org(db_session, "Live")
    _, waiting = await _org(db_session, "Waiting")
    _, drafted = await _org(db_session, "Drafted")
    await make_application(db_session, drop, live, decision=ApplicationDecision.ACCEPTED)
    left_waiting = await make_application(db_session, drop, waiting)
    await make_application(
        db_session, drop, drafted, decision=ApplicationDecision.ACCEPTED, sent=False
    )

    res = await app_client.post(f"/api/admin/drops/{drop.id}/wrap", headers=admin)
    assert res.status_code == 200, res.text
    await db_session.refresh(left_waiting)
    assert left_waiting.decision == ApplicationDecision.DENIED.value
    assert left_waiting.decision_sent_at is not None
    assert sorted(_kinds(sent)) == [
        ("application-denied", "drafted@example.edu"),
        ("application-denied", "waiting@example.edu"),
        ("drop-wrapped", BRAND),
        ("drop-wrapped-org", "live@example.edu"),
    ]


async def test_cancel_emails_orgs_in_the_running_and_brand(
    app_client: AsyncClient, db_session, sent
) -> None:
    admin = await admin_headers(db_session)
    drop = await _closed_drop(db_session)
    _, applied = await _org(db_session, "Applied")
    _, accepted = await _org(db_session, "Accepted")
    _, denied = await _org(db_session, "Denied")
    await make_application(db_session, drop, applied)
    await make_application(db_session, drop, accepted, decision=ApplicationDecision.ACCEPTED)
    await make_application(db_session, drop, denied, decision=ApplicationDecision.DENIED)

    res = await app_client.post(
        f"/api/admin/drops/{drop.id}/cancel", json={"confirm": "Snack drop"}, headers=admin
    )
    assert res.status_code == 200, res.text
    assert sorted(_kinds(sent)) == [
        ("drop-canceled", BRAND),
        ("drop-canceled-org", "accepted@example.edu"),
        ("drop-canceled-org", "applied@example.edu"),
    ]


async def test_choose_orgs_at_close_then_two_reminders(db_session, sent) -> None:
    drop = await _closed_drop(db_session)
    _, org = await _org(db_session, "Applicant")
    await make_application(db_session, drop, org)

    assert (await send_due_reminders(db_session))["choose_orgs_sent"] == 1
    assert _kinds(sent) == [("choose-orgs", BRAND)]
    # Not again until +2 days.
    assert (await send_due_reminders(db_session))["choose_orgs_sent"] == 0

    drop.apply_close_at = utcnow() - timedelta(days=2, hours=1)
    assert (await send_due_reminders(db_session))["choose_orgs_sent"] == 1
    drop.apply_close_at = utcnow() - timedelta(days=5, hours=1)
    assert (await send_due_reminders(db_session))["choose_orgs_sent"] == 1
    assert drop.choose_orgs_emails_sent == 3
    # Only the last one copies BUZZ ops: that is when BUZZ steps in (D-2).
    assert [cc is not None for *_, cc in sent] == [False, False, True]
    drop.apply_close_at = utcnow() - timedelta(days=8)
    assert (await send_due_reminders(db_session))["choose_orgs_sent"] == 0


async def test_choose_orgs_catches_up_with_one_email(db_session, sent) -> None:
    drop = await _closed_drop(db_session, closed_ago=timedelta(days=6))
    _, org = await _org(db_session, "Late")
    await make_application(db_session, drop, org)

    assert (await send_due_reminders(db_session))["choose_orgs_sent"] == 1
    assert drop.choose_orgs_emails_sent == 3
    assert len(sent) == 1


async def test_choose_orgs_stops_once_live_or_nobody_waits(db_session, sent) -> None:
    live = await _closed_drop(db_session)
    _, a = await _org(db_session, "Chosen")
    _, b = await _org(db_session, "Other")
    await make_application(db_session, live, a, decision=ApplicationDecision.ACCEPTED)
    await make_application(db_session, live, b)
    empty = await _closed_drop(db_session, brand=await db_session.get(Brand, live.brand_id))
    _, c = await _org(db_session, "Decided")
    await make_application(db_session, empty, c, decision=ApplicationDecision.DENIED)

    assert (await send_due_reminders(db_session))["choose_orgs_sent"] == 0
    assert sent == []
