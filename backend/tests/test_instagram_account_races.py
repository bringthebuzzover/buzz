"""Separate-connection races; opt in with a caller-verified existing local test DB.

BUZZ_VERIFIED_TEST_DATABASE_URL must name a disposable local BUZZ test database
with the current schema. Unlike the shared engine fixture, this creates/drops
no schema: only this module's committed rows are deleted in finally blocks.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import timedelta

import pytest
import pytest_asyncio
from fastapi import BackgroundTasks
from sqlalchemy import delete, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app import errors
from app.exceptions import BuzzAPIException
from app.jobs.metric_sync import _store_follower_count
from app.models.org_connect_token import OrgConnectToken
from app.models.org_ig_change_request import OrgIgChangeRequest
from app.models.organization import Organization
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.security.session import lock_user
from app.security.token_crypto import decrypt_token
from app.services import admin_erase, auth, ig_change_requests, onboarding, org_connect
from app.services.instagram_token import clear_stale_instagram_token
from app.timeutils import utcnow

from .conftest import FakeInstagramClient, make_org, make_user, persist


@pytest_asyncio.fixture
async def account_db():
    raw = os.environ.get("BUZZ_VERIFIED_TEST_DATABASE_URL")
    if not raw:
        pytest.skip("Requires caller-verified BUZZ_VERIFIED_TEST_DATABASE_URL; no schema DDL")
    url = make_url(raw)
    if url.drivername != "postgresql+asyncpg" or url.host not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail("Account race tests require an explicitly verified local asyncpg database")
    engine = create_async_engine(
        url,
        connect_args={"server_settings": {"lock_timeout": "5000", "statement_timeout": "10000"}},
    )
    factory = async_sessionmaker(engine, expire_on_commit=False)
    uid = uuid.uuid4()
    try:
        async with factory() as db:
            user = make_user(
                instagram_user_id=f"ig_{uid.hex}", instagram_username=f"a{uid.hex[:16]}"
            )
            user.id = uid
            user.instagram_token_user_id = f"token_{uid.hex}"
            user.instagram_granted_permissions = "instagram_business_basic"
            user.instagram_token_issued_at = utcnow() - timedelta(days=2)
            user.instagram_token_refreshed_at = user.instagram_token_issued_at
            user.instagram_token_expires_at = utcnow() + timedelta(days=30)
            await persist(db, user)
            org = await make_org(db, user)
            await db.commit()
            yield factory, uid, org.id
    finally:
        async with factory() as db:
            for model in (OrgConnectToken, OrgIgChangeRequest, EmailVerificationToken):
                await db.execute(delete(model).where(model.user_id == uid))
            await db.execute(delete(Organization).where(Organization.user_id == uid))
            await db.execute(delete(User).where(User.id == uid))
            await db.commit()
        await engine.dispose()


async def _ticket(db, uid, oid, *, awaiting=False):
    user = await db.get(User, uid)
    row = OrgIgChangeRequest(
        id=uuid.uuid4(),
        org_id=oid,
        user_id=uid,
        kind="account_switch",
        current_handle=user.instagram_username,
        requested_handle=f"b{uid.hex[:16]}",
        reason="Move to our new organization account.",
        status="awaiting_connect" if awaiting else "pending",
        decided_kind="account_switch" if awaiting else None,
    )
    if awaiting:
        user.instagram_user_id = None
        user.instagram_token_user_id = None
        user.instagram_access_token = None
        user.instagram_username = row.requested_handle
    db.add(row)
    await db.commit()
    return row


async def _login(db, uid, *, bind=False):
    ig = FakeInstagramClient(user_id=f"new_{uid.hex}" if bind else f"ig_{uid.hex}")
    ig.username = f"{'b' if bind else 'a'}{uid.hex[:16]}"
    ig.long_lived_token = "new-account-token" if bind else "ordinary-login-token"
    user = await auth.handle_instagram_callback(
        db, ig, "fake-code", bind_user_id=uid if bind else None
    )
    return await auth.issue_token_pair(db, user)


async def _run(db, operation):
    try:
        result = await operation(db)
        await db.commit()
        return result
    except BuzzAPIException as exc:
        await db.rollback()
        return exc


async def _race(factory, monkeypatch, first_op, second_op):
    """Pause winner after its account lock; prove the other connection blocks."""
    acquired, release, attempted = asyncio.Event(), asyncio.Event(), asyncio.Event()
    async with factory() as first, factory() as second, factory() as observer:
        second_pid = await second.scalar(text("SELECT pg_backend_pid()"))
        paused = False

        async def gated(db, uid):
            nonlocal paused
            if db is second:
                attempted.set()
            user = await lock_user(db, uid)
            if db is first and not paused:
                paused = True
                acquired.set()
                await asyncio.wait_for(release.wait(), 5)
            return user

        for module in (auth, admin_erase, ig_change_requests, org_connect, onboarding):
            monkeypatch.setattr(module, "lock_user", gated)
        tasks = []
        try:
            tasks.append(asyncio.create_task(_run(first, first_op)))
            await asyncio.wait_for(acquired.wait(), 5)
            tasks.append(asyncio.create_task(_run(second, second_op)))
            await asyncio.wait_for(attempted.wait(), 5)
            async with asyncio.timeout(4):
                while not await observer.scalar(
                    text("SELECT cardinality(pg_blocking_pids(:pid)) > 0"), {"pid": second_pid}
                ):
                    await asyncio.sleep(0.01)
            release.set()
            return await asyncio.wait_for(asyncio.gather(*tasks), 10)
        finally:
            release.set()
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)


async def _assert_erased(factory, uid):
    async with factory() as db:
        user = await db.get(User, uid)
        assert user.status == "erased"
        for field in (
            "instagram_user_id",
            "instagram_token_user_id",
            "instagram_username",
            "instagram_access_token",
            "instagram_token_issued_at",
            "instagram_token_expires_at",
            "instagram_token_refreshed_at",
            "instagram_granted_permissions",
        ):
            assert getattr(user, field) is None, field
        for model in (OrgIgChangeRequest, OrgConnectToken, EmailVerificationToken):
            assert await db.scalar(select(model.id).where(model.user_id == uid)) is None


@pytest.mark.parametrize("mutation", ["approve", "erase"])
@pytest.mark.parametrize("login_first", [False, True])
async def test_ordinary_login_serializes(account_db, monkeypatch, mutation, login_first):
    factory, uid, oid = account_db
    async with factory() as db:
        ticket = await _ticket(db, uid, oid)

    async def mutate(db):
        if mutation == "erase":
            return await admin_erase.erase_org_user(
                db, uid, ticket.current_handle, background_tasks=BackgroundTasks()
            )
        return await ig_change_requests.approve_request(
            db,
            ticket.id,
            kind="account_switch",
            tester_invite_confirmed=True,
            background_tasks=BackgroundTasks(),
        )

    async def login(db):
        return await _login(db, uid)

    operations = (login, mutate) if login_first else (mutate, login)
    outcomes = await _race(factory, monkeypatch, *operations)
    login_result = outcomes[0 if login_first else 1]
    if login_first:
        assert isinstance(login_result, tuple) and all(login_result)
    else:
        assert isinstance(login_result, BuzzAPIException)
        assert login_result.code == (
            errors.ACCOUNT_DENIED if mutation == "erase" else errors.INVALID_ONBOARDING_STATE
        )
        assert login_result.status_code == (403 if mutation == "erase" else 409)
    if mutation == "erase":
        await _assert_erased(factory, uid)
    else:
        async with factory() as db:
            user = await db.get(User, uid)
            assert user.instagram_user_id is None
            assert user.instagram_token_user_id is None
            assert user.instagram_access_token is None
            assert user.instagram_username == ticket.requested_handle
            assert user.instagram_token_issued_at is None
            assert user.instagram_token_expires_at is None
            assert user.instagram_token_refreshed_at is None
            assert user.instagram_granted_permissions == (
                "instagram_business_basic,instagram_business_manage_insights"
                if login_first
                else "instagram_business_basic"
            )
            assert (user.last_login_at is not None) == login_first
            assert (await db.get(OrgIgChangeRequest, ticket.id)).status == "awaiting_connect"
            assert user.token_version == (2 if login_first else 1)


async def test_stale_login_after_completed_bind(account_db, monkeypatch):
    factory, uid, oid = account_db
    selected, release = asyncio.Event(), asyncio.Event()
    async with factory() as stale, factory() as winner:
        ticket = await _ticket(winner, uid, oid)

        async def gate(db, user_id):
            if db is stale:
                selected.set()
                await asyncio.wait_for(release.wait(), 5)
            return await lock_user(db, user_id)

        monkeypatch.setattr(auth, "lock_user", gate)
        task = asyncio.create_task(_run(stale, lambda db: _login(db, uid)))
        try:
            await asyncio.wait_for(selected.wait(), 5)
            await ig_change_requests.approve_request(
                winner,
                ticket.id,
                kind="account_switch",
                tester_invite_confirmed=True,
                background_tasks=BackgroundTasks(),
            )
            assert all(await _login(winner, uid, bind=True))
            before = await winner.get(User, uid)
            fields = (
                "instagram_user_id",
                "instagram_token_user_id",
                "instagram_username",
                "instagram_access_token",
                "instagram_token_issued_at",
                "instagram_token_expires_at",
                "instagram_token_refreshed_at",
                "instagram_granted_permissions",
                "last_login_at",
                "token_version",
            )
            expected = tuple(getattr(before, field) for field in fields)
            release.set()
            result = await asyncio.wait_for(task, 5)
            assert isinstance(result, BuzzAPIException)
            assert (result.code, result.status_code) == (errors.INVALID_ONBOARDING_STATE, 409)
            await winner.refresh(before)
            assert tuple(getattr(before, field) for field in fields) == expected
            assert decrypt_token(before.instagram_access_token) == "new-account-token"
            assert (await winner.get(OrgIgChangeRequest, ticket.id)).status == "approved"
        finally:
            release.set()
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)


@pytest.mark.parametrize(
    "operation",
    ["approve", "bind", "redeem", "create_token", "submit", "verify", "create_verification"],
)
@pytest.mark.parametrize("erase_first", [False, True])
async def test_erasure_serializes_mutations(account_db, monkeypatch, operation, erase_first):
    factory, uid, oid = account_db
    async with factory() as db:
        user = await db.get(User, uid)
        old_handle = user.instagram_username
        if operation in {"bind", "redeem", "create_token"}:
            ticket = await _ticket(db, uid, oid, awaiting=True)
        elif operation == "approve":
            ticket = await _ticket(db, uid, oid)
        if operation == "redeem":
            org = await db.get(Organization, oid)
            raw, _ = await org_connect.create_org_connect_token(db, org, user)
        if operation in {"verify", "create_verification"}:
            user.status = "pending_email_verification"
            user.edu_email = f"org-{uid.hex}"
        if operation == "verify":
            from app.security.one_shot_tokens import hash_token

            raw = f"fake-{uid.hex}"
            db.add(
                EmailVerificationToken(
                    id=uuid.uuid4(),
                    user_id=uid,
                    email=user.edu_email,
                    token_hash=hash_token(raw),
                    expires_at=utcnow() + timedelta(hours=1),
                )
            )
        await db.commit()

    async def mutate(db):
        if operation == "approve":
            return await ig_change_requests.approve_request(
                db,
                ticket.id,
                kind="account_switch",
                tester_invite_confirmed=True,
                background_tasks=BackgroundTasks(),
            )
        if operation == "bind":
            return await _login(db, uid, bind=True)
        if operation == "redeem":
            user = await org_connect.redeem_org_connect_token(db, raw)
            return await auth.issue_token_pair(db, user)
        if operation == "verify":
            result = await onboarding.verify_email(db, raw)
            return await auth.issue_token_pair(db, result["user"])
        user = await db.get(User, uid)
        if operation == "create_verification":
            return await onboarding.resend_verification_email(db, user, BackgroundTasks())
        if operation == "create_token":
            return await org_connect.create_org_connect_token(
                db, await db.get(Organization, oid), user
            )
        return await ig_change_requests.submit_request(
            db, user, requested_handle=f"b{uid.hex[:16]}", reason="Move to our new account."
        )

    async def erase(db):
        confirm = (
            f"b{uid.hex[:16]}"
            if operation in {"bind", "redeem", "create_token"}
            or (operation == "approve" and not erase_first)
            else old_handle
        )
        return await admin_erase.erase_org_user(
            db, uid, confirm, background_tasks=BackgroundTasks()
        )

    operations = (erase, mutate) if erase_first else (mutate, erase)
    outcomes = await _race(factory, monkeypatch, *operations)
    erase_result = outcomes[0 if erase_first else 1]
    assert not isinstance(erase_result, BuzzAPIException)
    mutation_result = outcomes[1 if erase_first else 0]
    assert isinstance(mutation_result, BuzzAPIException) == erase_first
    if not erase_first and operation in {"bind", "redeem", "verify"}:
        assert isinstance(mutation_result, tuple) and all(mutation_result)
    await _assert_erased(factory, uid)


async def test_erasure_revalidates_confirmation(account_db, monkeypatch):
    factory, uid, oid = account_db
    async with factory() as db:
        ticket = await _ticket(db, uid, oid)

    async def approve(db):
        return await ig_change_requests.approve_request(
            db,
            ticket.id,
            kind="account_switch",
            tester_invite_confirmed=True,
            background_tasks=BackgroundTasks(),
        )

    async def erase(db):
        return await admin_erase.erase_org_user(
            db, uid, ticket.current_handle, background_tasks=BackgroundTasks()
        )

    _, result = await _race(factory, monkeypatch, approve, erase)
    assert isinstance(result, BuzzAPIException) and result.code == errors.VALIDATION_ERROR
    async with factory() as db:
        user = await db.get(User, uid)
        assert user.status == "active" and user.instagram_username == ticket.requested_handle
        assert (await db.get(OrgIgChangeRequest, ticket.id)).status == "awaiting_connect"


async def test_stale_cleanup_cannot_revoke_new_account(account_db):
    factory, uid, oid = account_db
    async with factory() as stale, factory() as winner:
        old = await stale.get(User, uid)
        ticket = await _ticket(winner, uid, oid)
        await ig_change_requests.approve_request(
            winner,
            ticket.id,
            kind="account_switch",
            tester_invite_confirmed=True,
            background_tasks=BackgroundTasks(),
        )
        await _login(winner, uid, bind=True)
        user = await winner.get(User, uid)
        version, token = user.token_version, user.instagram_access_token
        assert not await clear_stale_instagram_token(stale, old)
        await stale.commit()
        await winner.refresh(user)
        assert (user.token_version, user.instagram_access_token) == (version, token)


async def test_stale_follower_refresh_cannot_overwrite_reconnected_account(account_db):
    factory, uid, oid = account_db
    started, release = asyncio.Event(), asyncio.Event()
    async with factory() as stale, factory() as winner:
        old_user = await stale.get(User, uid)
        old_org = await stale.get(Organization, oid)
        old_token = decrypt_token(old_user.instagram_access_token)

        class DelayedOldProfile(FakeInstagramClient):
            async def fetch_profile(self, long_token):
                started.set()
                await asyncio.wait_for(release.wait(), 5)
                return await super().fetch_profile(long_token)

        old_ig = DelayedOldProfile(user_id=old_user.instagram_user_id)
        old_ig.followers_count = 100
        task = asyncio.create_task(
            _store_follower_count(stale, old_org, old_user, old_token, old_ig)
        )
        try:
            await asyncio.wait_for(started.wait(), 5)
            ticket = await _ticket(winner, uid, oid)
            await ig_change_requests.approve_request(
                winner,
                ticket.id,
                kind="account_switch",
                tester_invite_confirmed=True,
                background_tasks=BackgroundTasks(),
            )
            new_ig = FakeInstagramClient(user_id=f"new_{uid.hex}")
            new_ig.username = f"b{uid.hex[:16]}"
            new_ig.followers_count = 200
            user = await auth.handle_instagram_callback(
                winner, new_ig, "fake-code", bind_user_id=uid
            )
            await auth.issue_token_pair(winner, user)

            release.set()
            assert await asyncio.wait_for(task, 5) == "skipped"
            await winner.refresh(await winner.get(Organization, oid))
            assert (await winner.get(Organization, oid)).follower_count == 200
        finally:
            release.set()
            if not task.done():
                task.cancel()
            await asyncio.gather(task, return_exceptions=True)


@pytest.mark.parametrize("identity_field", ["instagram_user_id", "instagram_token_user_id"])
@pytest.mark.parametrize("callback_id", ["graph", "token"])
async def test_username_change_preserves_identity_match(
    account_db, monkeypatch, identity_field, callback_id
):
    from app.services.instagram import ShortLivedToken

    factory, uid, _oid = account_db
    selected, release = asyncio.Event(), asyncio.Event()
    graph_id, token_id = f"graph_{uid.hex}", f"token_{uid.hex}"
    async with factory() as stale, factory() as winner:
        user = await winner.get(User, uid)
        user.instagram_user_id = None
        user.instagram_token_user_id = None
        setattr(user, identity_field, graph_id if callback_id == "graph" else token_id)
        await winner.commit()

        class DistinctIds(FakeInstagramClient):
            async def exchange_code(self, code):
                return ShortLivedToken(access_token="fake-short", user_id=token_id)

        ig = DistinctIds(user_id=graph_id)
        ig.username = f"a{uid.hex[:16]}"

        async def gate(db, user_id):
            if db is stale:
                selected.set()
                await asyncio.wait_for(release.wait(), 5)
            return await lock_user(db, user_id)

        async def login(db):
            row = await auth.handle_instagram_callback(db, ig, "fake-code")
            return await auth.issue_token_pair(db, row)

        monkeypatch.setattr(auth, "lock_user", gate)
        task = asyncio.create_task(_run(stale, login))
        try:
            await asyncio.wait_for(selected.wait(), 5)
            user.instagram_username = f"renamed{uid.hex[:16]}"
            await winner.commit()
            release.set()
            result = await asyncio.wait_for(task, 5)
            assert isinstance(result, tuple) and all(result)
            await winner.refresh(user)
            assert (user.instagram_user_id, user.instagram_token_user_id) == (graph_id, token_id)
            assert user.instagram_username == ig.username
        finally:
            release.set()
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)


@pytest.mark.parametrize("action", ["approve", "deny", "retarget"])
async def test_decisions_refuse_erased_leftovers(account_db, action):
    factory, uid, oid = account_db
    async with factory() as db:
        ticket = await _ticket(db, uid, oid, awaiting=action == "retarget")
        user = await db.get(User, uid)
        user.status = "erased"
        await db.commit()
        before = user.instagram_username
        with pytest.raises(BuzzAPIException) as raised:
            if action == "approve":
                await ig_change_requests.approve_request(
                    db,
                    ticket.id,
                    kind="account_switch",
                    tester_invite_confirmed=True,
                    background_tasks=BackgroundTasks(),
                )
            elif action == "retarget":
                await ig_change_requests.retarget_awaiting_connect(db, ticket.id, "anotherclub")
            else:
                await ig_change_requests.deny_request(
                    db, ticket.id, background_tasks=BackgroundTasks()
                )
        assert (raised.value.code, raised.value.status_code) == (
            errors.INVALID_ONBOARDING_STATE,
            409,
        )
        await db.rollback()
        await db.refresh(user)
        await db.refresh(ticket)
        assert user.instagram_username == before
        assert ticket.status == ("awaiting_connect" if action == "retarget" else "pending")
        # The idempotent healing path takes the same account lock and purges
        # leftovers even though there is no handle confirmation on this branch.
        await admin_erase.erase_org_user(db, uid, "", background_tasks=BackgroundTasks())
        await db.commit()
    await _assert_erased(factory, uid)


async def test_login_wins_before_completed_switch(account_db, monkeypatch):
    factory, uid, oid = account_db
    async with factory() as db:
        ticket = await _ticket(db, uid, oid)

    async def login(db):
        return await _login(db, uid)

    async def switch_and_bind(db):
        await ig_change_requests.approve_request(
            db,
            ticket.id,
            kind="account_switch",
            tester_invite_confirmed=True,
            background_tasks=BackgroundTasks(),
        )
        return await _login(db, uid, bind=True)

    results = await _race(factory, monkeypatch, login, switch_and_bind)
    assert all(isinstance(result, tuple) and all(result) for result in results)
    async with factory() as db:
        user = await db.get(User, uid)
        assert (user.instagram_user_id, user.instagram_token_user_id) == (
            f"new_{uid.hex}",
            f"new_{uid.hex}",
        )
        assert user.instagram_username == ticket.requested_handle
        assert decrypt_token(user.instagram_access_token) == "new-account-token"
        assert user.token_version == 3
        assert (await db.get(OrgIgChangeRequest, ticket.id)).status == "approved"
