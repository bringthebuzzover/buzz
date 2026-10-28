"""One-off matcher for apply drafts left by already-erased orgs."""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.erased_apply_prefills import _count, _delete, _engine, _notices, main
from app.models.enums import OrgUserStatus, PortalRole
from app.models.org_apply_prefill import OrgApplyPrefill
from app.services.email import _org_erased_body, send_brand_erased_email
from app.services.erased_apply_prefill_leftovers import (
    _RETRY_AFTER_CAP_SECONDS,
    ORG_ERASURE_SUBJECT,
    ErasureNotice,
    ErasureScanError,
    delete_leftover_prefills,
    earliest_erasure_by_email,
    fetch_org_erasure_notices,
    is_org_erasure_message,
    leftover_prefill_ids,
    parse_resend_timestamp,
)
from tests.conftest import make_user, persist

ERASED_AT = datetime(2026, 1, 15, tzinfo=timezone.utc)
BEFORE = ERASED_AT - timedelta(days=2)
AFTER = ERASED_AT + timedelta(days=2)
ERASED_EMAIL = "erased-org@example.edu"


def _prefill(
    invite_email: str,
    *,
    created_at: datetime,
    edu_email: str | None = None,
    instagram_handle: str | None = None,
    used_by_user_id: uuid.UUID | None = None,
    shipping_line1: str | None = None,
) -> OrgApplyPrefill:
    return OrgApplyPrefill(
        token_hash=uuid.uuid4().hex + uuid.uuid4().hex,
        invite_email=invite_email,
        edu_email=edu_email,
        instagram_handle=instagram_handle,
        shipping_line1=shipping_line1,
        shipping_city="Ithaca" if shipping_line1 else None,
        shipping_state="NY" if shipping_line1 else None,
        shipping_postal_code="14850" if shipping_line1 else None,
        created_at=created_at,
        expires_at=created_at + timedelta(days=30),
        used_by_user_id=used_by_user_id,
    )


async def _erased_user(db: AsyncSession):
    user = await persist(db, make_user(role=PortalRole.ORG, status=OrgUserStatus.ERASED))
    user.edu_email = None
    user.pending_edu_email = None
    user.instagram_username = None
    await db.flush()
    return user


async def _live_user(db: AsyncSession, *, edu_email: str | None = None):
    user = await persist(db, make_user(role=PortalRole.ORG, status=OrgUserStatus.ACTIVE))
    if edu_email is not None:
        user.edu_email = edu_email
        await db.flush()
    return user


async def test_matched_leftovers_are_deleted(db_session: AsyncSession) -> None:
    """Unclaimed email matches and drafts linked to the erased user are removed."""

    erased = await _erased_user(db_session)
    notice = ErasureNotice(email="Erased-Org@Example.EDU", erased_at=ERASED_AT)
    invite_match = _prefill(
        ERASED_EMAIL,
        created_at=BEFORE,
        edu_email=None,
        instagram_handle="oldchapter",
        shipping_line1="1 Test Lane",
    )
    edu_match = _prefill(
        "personal-inbox@example.com",
        created_at=BEFORE,
        edu_email="  Erased-Org@Example.edu ",
        shipping_line1="2 Test Lane",
    )
    linked = _prefill(
        "someone-else@example.edu",
        created_at=AFTER,
        used_by_user_id=erased.id,
        shipping_line1="3 Test Lane",
    )
    db_session.add_all([invite_match, edu_match, linked])
    await db_session.flush()
    invite_id, edu_id, linked_id = invite_match.id, edu_match.id, linked.id

    deleted = await delete_leftover_prefills(db_session, [notice])
    db_session.expire_all()

    assert deleted == 3
    assert await db_session.get(OrgApplyPrefill, invite_id) is None
    assert await db_session.get(OrgApplyPrefill, edu_id) is None
    assert await db_session.get(OrgApplyPrefill, linked_id) is None


async def test_live_pending_draft_is_kept(db_session: AsyncSession) -> None:
    """A live account holding the notice address keeps the matching draft."""

    await _live_user(db_session, edu_email=ERASED_EMAIL)
    pending = _prefill(
        ERASED_EMAIL,
        created_at=BEFORE,
        edu_email=ERASED_EMAIL,
        instagram_handle="livechapter",
        shipping_line1="9 Live Street",
    )
    db_session.add(pending)
    await db_session.flush()
    pending_id = pending.id

    deleted = await delete_leftover_prefills(
        db_session, [ErasureNotice(email=ERASED_EMAIL, erased_at=ERASED_AT)]
    )
    db_session.expire_all()

    assert deleted == 0
    assert await db_session.get(OrgApplyPrefill, pending_id) is not None


async def test_draft_used_by_another_account_is_kept(db_session: AsyncSession) -> None:
    other = await _live_user(db_session)
    owned = _prefill(
        ERASED_EMAIL,
        created_at=BEFORE,
        edu_email=ERASED_EMAIL,
        instagram_handle="sharedhandle",
        shipping_line1="4 Other Street",
        used_by_user_id=other.id,
    )
    db_session.add(owned)
    await db_session.flush()
    owned_id = owned.id

    deleted = await delete_leftover_prefills(
        db_session, [ErasureNotice(email=ERASED_EMAIL, erased_at=ERASED_AT)]
    )
    db_session.expire_all()

    assert deleted == 0
    assert await db_session.get(OrgApplyPrefill, owned_id) is not None


async def test_count_does_not_write(db_session: AsyncSession) -> None:
    row = _prefill(ERASED_EMAIL, created_at=BEFORE, shipping_line1="5 Count Lane")
    db_session.add(row)
    await db_session.flush()
    before = await db_session.scalar(select(func.count()).select_from(OrgApplyPrefill))

    ids = await leftover_prefill_ids(
        db_session, [ErasureNotice(email=ERASED_EMAIL, erased_at=ERASED_AT)]
    )
    after = await db_session.scalar(select(func.count()).select_from(OrgApplyPrefill))

    assert ids == [row.id]
    assert after == before
    assert await db_session.get(OrgApplyPrefill, row.id) is not None


async def test_draft_created_after_the_notice_is_kept(db_session: AsyncSession) -> None:
    later = _prefill(ERASED_EMAIL, created_at=AFTER, shipping_line1="6 Later Lane")
    db_session.add(later)
    await db_session.flush()
    later_id = later.id

    deleted = await delete_leftover_prefills(
        db_session, [ErasureNotice(email=ERASED_EMAIL, erased_at=ERASED_AT)]
    )
    db_session.expire_all()

    assert deleted == 0
    assert await db_session.get(OrgApplyPrefill, later_id) is not None


async def test_reused_email_on_a_live_account_is_kept(db_session: AsyncSession) -> None:
    await _live_user(db_session, edu_email=ERASED_EMAIL)
    draft = _prefill(ERASED_EMAIL, created_at=BEFORE, shipping_line1="7 Reused Lane")
    db_session.add(draft)
    await db_session.flush()
    draft_id = draft.id

    deleted = await delete_leftover_prefills(
        db_session, [ErasureNotice(email=ERASED_EMAIL, erased_at=ERASED_AT)]
    )
    db_session.expire_all()

    assert deleted == 0
    assert await db_session.get(OrgApplyPrefill, draft_id) is not None


async def test_live_invite_keeps_a_draft_matched_on_edu(db_session: AsyncSession) -> None:
    """The erased school email matches, and the invite belongs to a live user."""

    holder = "live-holder@example.edu"
    await _live_user(db_session, edu_email=f"  {holder.upper()} ")
    draft = _prefill(
        f"  {holder.upper()}  ",
        created_at=BEFORE,
        edu_email=ERASED_EMAIL,
        shipping_line1="17 Split Lane",
    )
    db_session.add(draft)
    await db_session.flush()
    draft_id = draft.id

    deleted = await delete_leftover_prefills(
        db_session, [ErasureNotice(email=ERASED_EMAIL, erased_at=ERASED_AT)]
    )
    db_session.expire_all()

    assert deleted == 0
    assert await db_session.get(OrgApplyPrefill, draft_id) is not None


async def test_live_edu_keeps_a_draft_matched_on_invite(db_session: AsyncSession) -> None:
    """The erased invite matches, and the school email belongs to a live user."""

    holder = "live-holder@example.edu"
    user = await _live_user(db_session)
    user.pending_edu_email = f"  {holder.upper()} "
    await db_session.flush()
    draft = _prefill(
        ERASED_EMAIL,
        created_at=BEFORE,
        edu_email=holder,
        shipping_line1="18 Split Lane",
    )
    db_session.add(draft)
    await db_session.flush()
    draft_id = draft.id

    deleted = await delete_leftover_prefills(
        db_session, [ErasureNotice(email=ERASED_EMAIL, erased_at=ERASED_AT)]
    )
    db_session.expire_all()

    assert deleted == 0
    assert await db_session.get(OrgApplyPrefill, draft_id) is not None


async def test_erased_org_link_is_kept_when_another_address_is_live(
    db_session: AsyncSession,
) -> None:
    erased = await _erased_user(db_session)
    holder = "live-holder@example.edu"
    await _live_user(db_session, edu_email=holder)
    draft = _prefill(
        holder,
        created_at=BEFORE,
        edu_email=ERASED_EMAIL,
        used_by_user_id=erased.id,
        shipping_line1="19 Linked Lane",
    )
    db_session.add(draft)
    await db_session.flush()
    draft_id = draft.id

    deleted = await delete_leftover_prefills(
        db_session, [ErasureNotice(email=ERASED_EMAIL, erased_at=ERASED_AT)]
    )
    db_session.expire_all()

    assert deleted == 0
    assert await db_session.get(OrgApplyPrefill, draft_id) is not None


async def test_draft_between_two_notices_uses_the_earliest(db_session: AsyncSession) -> None:
    first = datetime(2026, 1, 1, tzinfo=timezone.utc)
    second = datetime(2026, 6, 1, tzinfo=timezone.utc)
    between = _prefill(
        ERASED_EMAIL,
        created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        shipping_line1="8 Between Lane",
    )
    db_session.add(between)
    await db_session.flush()
    between_id = between.id
    notices = [
        ErasureNotice(email=ERASED_EMAIL, erased_at=second),
        ErasureNotice(email=ERASED_EMAIL, erased_at=first),
    ]

    assert earliest_erasure_by_email(notices)[ERASED_EMAIL] == first
    deleted = await delete_leftover_prefills(db_session, notices)
    db_session.expire_all()

    assert deleted == 0
    assert await db_session.get(OrgApplyPrefill, between_id) is not None


def test_org_erasure_body_marker_matches_shipped_copy() -> None:
    assert is_org_erasure_message(ORG_ERASURE_SUBJECT, _org_erased_body("Example Org"), None)
    historical = (
        "Your Buzz login identity, contact details, and Instagram credentials "
        "on file have been removed or anonymized."
    )
    assert is_org_erasure_message(ORG_ERASURE_SUBJECT, historical, None)
    assert not is_org_erasure_message("Welcome", historical, None)


async def test_brand_erasure_body_is_not_an_org_notice(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, str] = {}

    async def capture(
        to_email: str,
        subject: str,
        body: str,
        *,
        idempotency_key: str | None = None,
    ) -> bool:
        del to_email, idempotency_key
        captured["subject"] = subject
        captured["body"] = body
        return True

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr("app.services.email._dispatch", capture)
    sent = await send_brand_erased_email("brand@example.com", brand_name="Example Brand")

    assert sent is True
    assert captured["body"]
    assert not is_org_erasure_message(captured["subject"], captured["body"], None)


def test_parse_resend_timestamp() -> None:
    parsed = parse_resend_timestamp("2026-04-03 22:13:42.674981+00")
    assert parsed == datetime(2026, 4, 3, 22, 13, 42, 674981, tzinfo=timezone.utc)


def test_blank_notice_matches_nothing() -> None:
    assert earliest_erasure_by_email([ErasureNotice(email="   ", erased_at=ERASED_AT)]) == {}


@pytest.mark.asyncio
async def test_fetch_keeps_org_erasure_only() -> None:
    org_id = "4ef9a417-02e9-4d39-ad75-9611e0fcc33c"
    brand_id = "3a9f8c2b-1e5d-4f8a-9c7b-2d6e5f8a9c7b"
    other_id = "11111111-1111-4111-8111-111111111111"
    stamp = "2026-04-03 22:13:42.674981+00"
    pages = {
        None: {
            "has_more": True,
            "data": [
                {
                    "id": other_id,
                    "to": ["ignored@example.edu"],
                    "subject": "Your drop is open",
                    "created_at": stamp,
                },
                {
                    "id": brand_id,
                    "to": ["brand-person@example.com"],
                    "subject": ORG_ERASURE_SUBJECT,
                    "created_at": stamp,
                },
            ],
        },
        brand_id: {
            "has_more": False,
            "data": [
                {
                    "id": org_id,
                    "to": ["Erased-Org@Example.EDU"],
                    "subject": f"  {ORG_ERASURE_SUBJECT}  ",
                    "created_at": stamp,
                }
            ],
        },
    }
    bodies = {
        brand_id: {"text": "anonymized brand name", "html": None},
        org_id: {
            "text": None,
            "html": "Instagram credentials were removed from the account.",
        },
    }

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == f"/emails/{brand_id}":
            return httpx.Response(200, json=bodies[brand_id])
        if request.url.path == f"/emails/{org_id}":
            return httpx.Response(200, json=bodies[org_id])
        after = request.url.params.get("after")
        return httpx.Response(200, json=pages[after])

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport, base_url="https://api.resend.com") as client:
        notices = await fetch_org_erasure_notices(client)

    assert notices == [
        ErasureNotice(
            email=ERASED_EMAIL,
            erased_at=datetime(2026, 4, 3, 22, 13, 42, 674981, tzinfo=timezone.utc),
        )
    ]


@pytest.mark.asyncio
async def test_fetch_retries_then_error_hides_the_body(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, json={"to": "hidden-person@example.edu"})
        return httpx.Response(200, json={"data": [], "has_more": False})

    async def _no_sleep(_delay: float) -> None:
        return None

    monkeypatch.setattr("app.services.erased_apply_prefill_leftovers.asyncio.sleep", _no_sleep)
    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport, base_url="https://api.resend.com") as client:
        notices = await fetch_org_erasure_notices(client)
    assert notices == []
    assert calls["n"] == 2

    def denied(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"to": "hidden-person@example.edu"})

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(denied), base_url="https://api.resend.com"
    ) as client:
        with pytest.raises(ErasureScanError) as caught:
            await fetch_org_erasure_notices(client)
    message = str(caught.value)
    assert "status=401" in message
    assert "hidden-person@example.edu" not in message


async def test_retry_after_is_honored_and_capped(monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps: list[float] = []

    async def _record(delay: float) -> None:
        sleeps.append(delay)

    monkeypatch.setattr("app.services.erased_apply_prefill_leftovers.asyncio.sleep", _record)
    calls = {"n": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, json={})
        if calls["n"] == 2:
            return httpx.Response(429, headers={"Retry-After": "4"}, json={})
        if calls["n"] == 3:
            return httpx.Response(429, headers={"Retry-After": "9999"}, json={})
        return httpx.Response(200, json={"data": [], "has_more": False})

    assert await _fetch(handler) == []
    assert sleeps == [0.5, 4.0, _RETRY_AFTER_CAP_SECONDS]


def test_delete_without_yes_writes_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    def _boom() -> int:
        raise AssertionError("delete ran")

    monkeypatch.setattr("app.erased_apply_prefills._delete", _boom)
    assert main(["delete"]) == 2
    assert main(["delete", "--force"]) == 2


def test_count_is_the_default(monkeypatch: pytest.MonkeyPatch) -> None:
    called = {"n": 0}

    async def _fake() -> int:
        called["n"] += 1
        return 0

    monkeypatch.setattr("app.erased_apply_prefills._count", _fake)
    assert main([]) == 0
    assert main(["count"]) == 0
    assert called["n"] == 2


_STAMP = "2026-04-03 22:13:42.674981+00"


async def _fetch(handler) -> list[ErasureNotice]:
    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport, base_url="https://api.resend.com") as client:
        return await fetch_org_erasure_notices(client)


def _list_row(email_id: str, *, subject: str = "Hello", created_at: str | None = _STAMP) -> dict:
    row: dict = {
        "id": email_id,
        "to": ["a@example.edu"],
        "subject": subject,
    }
    if created_at is not None:
        row["created_at"] = created_at
    return row


async def test_pending_edu_email_on_a_live_user_keeps_the_draft(db_session: AsyncSession) -> None:
    user = await _live_user(db_session)
    user.pending_edu_email = ERASED_EMAIL
    await db_session.flush()
    draft = _prefill(ERASED_EMAIL, created_at=BEFORE, shipping_line1="10 Pending Lane")
    db_session.add(draft)
    await db_session.flush()
    draft_id = draft.id

    deleted = await delete_leftover_prefills(
        db_session, [ErasureNotice(email=ERASED_EMAIL, erased_at=ERASED_AT)]
    )
    db_session.expire_all()

    assert deleted == 0
    assert await db_session.get(OrgApplyPrefill, draft_id) is not None


@pytest.mark.parametrize("role", [PortalRole.BRAND, PortalRole.ADMIN])
async def test_live_non_org_user_holding_the_address_keeps_the_draft(
    db_session: AsyncSession, role: PortalRole
) -> None:
    user = await persist(db_session, make_user(role=role, status=OrgUserStatus.ACTIVE))
    user.edu_email = ERASED_EMAIL
    user.pending_edu_email = None
    await db_session.flush()
    draft = _prefill(ERASED_EMAIL, created_at=BEFORE, shipping_line1="11 Other Portal Lane")
    db_session.add(draft)
    await db_session.flush()
    draft_id = draft.id

    deleted = await delete_leftover_prefills(
        db_session, [ErasureNotice(email=ERASED_EMAIL, erased_at=ERASED_AT)]
    )
    db_session.expire_all()

    assert deleted == 0
    assert await db_session.get(OrgApplyPrefill, draft_id) is not None


async def test_draft_created_at_the_cutoff_is_deleted(db_session: AsyncSession) -> None:
    exact = _prefill(ERASED_EMAIL, created_at=ERASED_AT, shipping_line1="12 Cutoff Lane")
    db_session.add(exact)
    await db_session.flush()
    exact_id = exact.id

    deleted = await delete_leftover_prefills(
        db_session, [ErasureNotice(email=ERASED_EMAIL, erased_at=ERASED_AT)]
    )
    db_session.expire_all()

    assert deleted == 1
    assert await db_session.get(OrgApplyPrefill, exact_id) is None


async def test_draft_claimed_by_an_erased_brand_user_is_kept(db_session: AsyncSession) -> None:
    brand = await persist(db_session, make_user(role=PortalRole.BRAND, status=OrgUserStatus.ERASED))
    brand.edu_email = None
    brand.pending_edu_email = None
    await db_session.flush()
    draft = _prefill(
        ERASED_EMAIL,
        created_at=BEFORE,
        used_by_user_id=brand.id,
        shipping_line1="13 Brand Lane",
    )
    db_session.add(draft)
    await db_session.flush()
    draft_id = draft.id

    deleted = await delete_leftover_prefills(
        db_session, [ErasureNotice(email=ERASED_EMAIL, erased_at=ERASED_AT)]
    )
    db_session.expire_all()

    assert deleted == 0
    assert await db_session.get(OrgApplyPrefill, draft_id) is not None


async def test_signup_before_delete_keeps_the_draft(db_session: AsyncSession) -> None:
    """The delete statement rechecks the live user. It does not trust an earlier id list."""

    draft = _prefill(ERASED_EMAIL, created_at=BEFORE, shipping_line1="14 Race Lane")
    db_session.add(draft)
    await db_session.flush()
    draft_id = draft.id
    notices = [ErasureNotice(email=ERASED_EMAIL, erased_at=ERASED_AT)]

    assert await leftover_prefill_ids(db_session, notices) == [draft_id]
    await _live_user(db_session, edu_email=ERASED_EMAIL)

    deleted = await delete_leftover_prefills(db_session, notices)
    db_session.expire_all()

    assert deleted == 0
    assert await db_session.get(OrgApplyPrefill, draft_id) is not None


async def test_list_page_without_data_is_an_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"has_more": False})

    with pytest.raises(ErasureScanError, match="missing data"):
        await _fetch(handler)


async def test_has_more_with_no_rows_is_an_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"has_more": True, "data": []})

    with pytest.raises(ErasureScanError, match="no rows"):
        await _fetch(handler)


async def test_pagination_that_does_not_advance_is_an_error() -> None:
    page = {"has_more": True, "data": [_list_row(str(uuid.uuid4()))]}

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=page)

    with pytest.raises(ErasureScanError, match="did not advance"):
        await _fetch(handler)


async def test_page_cap_is_an_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.erased_apply_prefill_leftovers._MAX_LIST_PAGES", 2)
    ids = [str(uuid.uuid4()), str(uuid.uuid4())]
    calls = {"n": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        row_id = ids[min(calls["n"], 1)]
        calls["n"] += 1
        return httpx.Response(200, json={"has_more": True, "data": [_list_row(row_id)]})

    with pytest.raises(ErasureScanError, match="page cap"):
        await _fetch(handler)
    assert calls["n"] == 2


@pytest.mark.parametrize(
    ("row_id", "match"),
    [
        (None, "missing an id"),
        ("not-a-uuid", "invalid id"),
        ("hidden-person@example.edu", "invalid id"),
    ],
)
async def test_bad_or_missing_list_id_is_an_error(row_id: str | None, match: str) -> None:
    row = _list_row("00000000-0000-4000-8000-000000000001")
    if row_id is None:
        del row["id"]
    else:
        row["id"] = row_id

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"has_more": False, "data": [row]})

    with pytest.raises(ErasureScanError, match=match) as caught:
        await _fetch(handler)
    assert "hidden-person@example.edu" not in str(caught.value)


async def test_org_notice_missing_created_at_is_an_error() -> None:
    email_id = str(uuid.uuid4())

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == f"/emails/{email_id}":
            return httpx.Response(200, json={"text": "Instagram credentials removed"})
        row = _list_row(email_id, subject=ORG_ERASURE_SUBJECT, created_at=None)
        return httpx.Response(200, json={"has_more": False, "data": [row]})

    with pytest.raises(ErasureScanError, match="missing a timestamp"):
        await _fetch(handler)


async def test_non_json_body_is_an_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="not-json")

    with pytest.raises(ErasureScanError, match="not JSON"):
        await _fetch(handler)


async def test_network_error_hides_the_detail() -> None:
    secret = "hidden-person@example.edu"

    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(secret)

    with pytest.raises(ErasureScanError, match="Resend request failed") as caught:
        await _fetch(handler)
    assert secret not in str(caught.value)


async def test_restricted_api_key_names_the_missing_permission() -> None:
    secret = "hidden-person@example.edu"

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            401,
            json={"name": "restricted_api_key", "message": f"cannot read {secret}"},
        )

    with pytest.raises(ErasureScanError) as caught:
        await _fetch(handler)
    message = str(caught.value)
    assert "restricted_api_key" in message
    assert "missing permission to list sent emails" in message
    assert "sending-only" in message
    assert secret not in message


async def test_unset_resend_key_refuses_to_scan(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "RESEND_API_KEY", "   ")
    with pytest.raises(ErasureScanError, match="RESEND_API_KEY is unset"):
        await _notices()


def test_cli_engine_hides_sql_parameters() -> None:
    assert _engine.sync_engine.hide_parameters is True


def _bind_cli(
    monkeypatch: pytest.MonkeyPatch,
    db_session: AsyncSession,
    events: list[str],
    *,
    call_commit: bool,
) -> None:
    real_commit = db_session.commit

    async def commit() -> None:
        events.append("commit")
        if call_commit:
            await real_commit()

    async def rollback() -> None:
        # Record only. Session.rollback() rolls back the harness transaction,
        # so calling it here would drop the fixture row even though count
        # issued no DELETE. A real delete would still leave the row gone.
        events.append("rollback")

    monkeypatch.setattr(db_session, "commit", commit)
    monkeypatch.setattr(db_session, "rollback", rollback)

    @asynccontextmanager
    async def factory():
        yield db_session

    monkeypatch.setattr("app.erased_apply_prefills.async_session_factory", factory)

    async def notices() -> list[ErasureNotice]:
        return [ErasureNotice(email=ERASED_EMAIL, erased_at=ERASED_AT)]

    monkeypatch.setattr("app.erased_apply_prefills._notices", notices)


async def test_cli_count_rolls_back(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    row = _prefill(ERASED_EMAIL, created_at=BEFORE, shipping_line1="15 Count Lane")
    db_session.add(row)
    await db_session.flush()
    row_id = row.id
    await db_session.commit()
    events: list[str] = []
    _bind_cli(monkeypatch, db_session, events, call_commit=False)

    assert await _count() == 0
    db_session.expire_all()

    assert events == ["rollback"]
    assert await db_session.get(OrgApplyPrefill, row_id) is not None
    captured = capsys.readouterr()
    assert f"id={row_id}" in captured.out
    assert ERASED_EMAIL not in captured.out
    assert ERASED_EMAIL not in captured.err


async def test_cli_delete_commits(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    row = _prefill(ERASED_EMAIL, created_at=BEFORE, shipping_line1="16 Delete Lane")
    db_session.add(row)
    await db_session.flush()
    row_id = row.id
    await db_session.commit()
    events: list[str] = []
    _bind_cli(monkeypatch, db_session, events, call_commit=True)

    assert await _delete() == 0
    db_session.expire_all()

    assert events == ["commit"]
    assert await db_session.get(OrgApplyPrefill, row_id) is None
    captured = capsys.readouterr()
    assert "deleted=1" in captured.out
    assert ERASED_EMAIL not in captured.out
    assert ERASED_EMAIL not in captured.err


@pytest.mark.parametrize("entry", ["count", "delete"])
async def test_cli_database_error_hides_addresses(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    entry: str,
) -> None:
    secret = "erased-org@example.edu"

    async def boom(*_args: object, **_kwargs: object) -> list[uuid.UUID]:
        raise RuntimeError(f"parameter {secret}")

    target = (
        "app.erased_apply_prefills.leftover_prefill_ids"
        if entry == "count"
        else "app.erased_apply_prefills.delete_leftover_prefills"
    )
    monkeypatch.setattr(target, boom)

    @asynccontextmanager
    async def factory():
        yield db_session

    monkeypatch.setattr("app.erased_apply_prefills.async_session_factory", factory)

    async def notices() -> list[ErasureNotice]:
        return [ErasureNotice(email=secret, erased_at=ERASED_AT)]

    monkeypatch.setattr("app.erased_apply_prefills._notices", notices)
    code = await (_count() if entry == "count" else _delete())
    captured = capsys.readouterr()

    assert code == 1
    assert "Database error. Nothing was deleted." in captured.err
    assert secret not in captured.err
    assert secret not in captured.out
