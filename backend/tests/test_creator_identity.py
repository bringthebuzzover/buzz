"""Creator apply, verify, approve, and deny. Org accounts stay unchanged."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import func, select

from app.models.creator import Creator
from app.models.enums import CreatorStatus, OrgUserStatus, PortalRole
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.security.one_shot_tokens import hash_token
from tests.conftest import make_user, mint_access_token, persist

_APPLY = {
    "name": "Ada Lovelace",
    "school": "Cornell",
    "city": "Ithaca",
    "gradYear": "2027",
    "eduEmail": "ada@cornell.edu",
    "claimedHandle": "ada.creates",
    "niches": ["photo"],
    "bio": "Campus photo essays.",
    "tiktokHandle": "",
    "openTo": ["Flat fee"],
}


async def _admin_headers(db_session) -> dict:
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


async def _apply(app_client: AsyncClient, email: str = "ada@cornell.edu") -> dict:
    body = {**_APPLY, "eduEmail": email}
    res = await app_client.post("/api/creators/apply", json=body)
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert "accessToken" not in data
    assert "access_token" not in data
    return data


class TestCreatorIdentity:
    async def test_apply_rejects_non_edu(self, app_client: AsyncClient):
        res = await app_client.post(
            "/api/creators/apply",
            json={**_APPLY, "eduEmail": "ada@gmail.com"},
        )
        assert res.status_code == 422

    async def test_duplicate_creator_email_rejected(self, app_client: AsyncClient):
        await _apply(app_client)
        res = await app_client.post("/api/creators/apply", json=_APPLY)
        assert res.status_code == 409
        assert res.json()["error"]["code"] == "EDU_EMAIL_TAKEN"

    async def test_org_email_does_not_block_creator(self, app_client: AsyncClient, db_session):
        org = make_user(role=PortalRole.ORG)
        org.edu_email = "shared@cornell.edu"
        org.pending_edu_email = "pending-shared@cornell.edu"
        await persist(db_session, org)

        created = await _apply(app_client, "shared@cornell.edu")
        assert created["status"] == CreatorStatus.PENDING_EMAIL.value

        pending = make_user(role=PortalRole.CREATOR)
        pending.edu_email = "other@cornell.edu"
        pending.pending_edu_email = "pending-shared@cornell.edu"
        await persist(db_session, pending)

        rows = (
            await db_session.scalars(
                select(User).where(func.lower(User.edu_email) == "shared@cornell.edu")
            )
        ).all()
        roles = {row.portal_role for row in rows}
        assert roles == {PortalRole.ORG.value, PortalRole.CREATOR.value}

    async def test_verify_is_one_shot_and_does_not_open_the_feed(
        self, app_client: AsyncClient, db_session
    ):
        created = await _apply(app_client, "verify@cornell.edu")
        creator = await db_session.get(Creator, created["creatorId"])
        assert creator is not None
        token_row = await db_session.scalar(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == creator.user_id)
        )
        assert token_row is not None
        raw = "known-verify-token"
        token_row.token_hash = hash_token(raw)
        await db_session.flush()

        first = await app_client.post("/api/creators/verify-email", json={"token": raw})
        assert first.status_code == 200, first.text
        assert first.json()["data"]["status"] == CreatorStatus.PENDING_REVIEW.value
        assert "accessToken" not in first.json()["data"]

        second = await app_client.post("/api/creators/verify-email", json={"token": raw})
        assert second.status_code == 400
        assert second.json()["error"]["code"] == "EMAIL_ALREADY_VERIFIED"

        user = await db_session.get(User, creator.user_id)
        assert user is not None
        assert user.status == OrgUserStatus.ACTIVE.value
        feed = await app_client.get(
            "/api/creators/feed",
            headers={"Authorization": f"Bearer {mint_access_token(user)}"},
        )
        assert feed.status_code == 403

    async def test_approve_and_deny_only_from_review(self, app_client: AsyncClient, db_session):
        headers = await _admin_headers(db_session)
        created = await _apply(app_client, "review@cornell.edu")
        creator_id = created["creatorId"]

        early = await app_client.post(
            f"/api/admin/creators/{creator_id}/approve",
            headers=headers,
        )
        assert early.status_code == 400
        assert early.json()["error"]["code"] == "INVALID_ONBOARDING_STATE"

        creator = await db_session.get(Creator, creator_id)
        assert creator is not None
        token_row = await db_session.scalar(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == creator.user_id)
        )
        assert token_row is not None
        raw = "review-token"
        token_row.token_hash = hash_token(raw)
        await db_session.flush()
        verified = await app_client.post("/api/creators/verify-email", json={"token": raw})
        assert verified.status_code == 200

        approved = await app_client.post(
            f"/api/admin/creators/{creator_id}/approve",
            headers=headers,
        )
        assert approved.status_code == 200, approved.text
        assert approved.json()["data"]["status"] == CreatorStatus.PENDING_INSTAGRAM.value
        assert "accessToken" not in approved.json()["data"]

        again = await app_client.post(
            f"/api/admin/creators/{creator_id}/deny",
            headers=headers,
        )
        assert again.status_code == 400

    async def test_denied_creator_has_no_feed_session(self, app_client: AsyncClient, db_session):
        headers = await _admin_headers(db_session)
        created = await _apply(app_client, "denied@cornell.edu")
        creator = await db_session.get(Creator, created["creatorId"])
        assert creator is not None
        token_row = await db_session.scalar(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == creator.user_id)
        )
        assert token_row is not None
        raw = "deny-token"
        token_row.token_hash = hash_token(raw)
        await db_session.flush()
        assert (
            await app_client.post("/api/creators/verify-email", json={"token": raw})
        ).status_code == 200

        user = await db_session.get(User, creator.user_id)
        assert user is not None
        before = mint_access_token(user)

        denied = await app_client.post(
            f"/api/admin/creators/{creator.id}/deny",
            headers=headers,
        )
        assert denied.status_code == 200
        assert denied.json()["data"]["status"] == CreatorStatus.DENIED.value

        await db_session.refresh(user)
        revoked = await app_client.get(
            "/api/creators/feed",
            headers={"Authorization": f"Bearer {before}"},
        )
        assert revoked.status_code == 401

        fresh = await app_client.get(
            "/api/creators/feed",
            headers={"Authorization": f"Bearer {mint_access_token(user)}"},
        )
        assert fresh.status_code == 403
