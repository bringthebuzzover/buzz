"""One-off matcher for apply drafts left by already-erased orgs."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.erased_apply_prefills import main
from app.models.enums import OrgUserStatus, PortalRole
from app.models.org_apply_prefill import OrgApplyPrefill
from app.services.email import _org_erased_body
from app.services.erased_apply_prefill_leftovers import (
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
LIVE_EMAIL = "live-applicant@example.edu"


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
    await _erased_user(db_session)
    pending = _prefill(
        LIVE_EMAIL,
        created_at=BEFORE,
        edu_email=LIVE_EMAIL,
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
    brand = (
        "Your Buzz login identity and contact details on file have been removed "
        "or anonymized. Campaign records stay visible as an anonymized brand name."
    )
    assert not is_org_erasure_message(ORG_ERASURE_SUBJECT, brand, None)
    assert not is_org_erasure_message("Welcome", historical, None)


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
