"""Invite/verify mint stores SHA-256 hex, never the raw email secret."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models.brand_invite_token import BrandInviteToken
from app.models.enums import OrgUserStatus
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.security.one_shot_tokens import hash_token
from app.services import onboarding
from app.services.brand_auth import create_brand_invite
from tests.conftest import make_brand, make_user, persist


@pytest.mark.asyncio
async def test_brand_invite_mint_persists_hash_not_raw(db_session) -> None:
    brand = await make_brand(db_session)
    user = await db_session.get(User, brand.user_id)
    assert user is not None
    raw = await create_brand_invite(db_session, brand, user)
    row = await db_session.scalar(
        select(BrandInviteToken).where(BrandInviteToken.brand_id == brand.id)
    )
    assert row is not None
    assert row.token_hash == hash_token(raw)
    assert raw != row.token_hash


@pytest.mark.asyncio
async def test_verification_mint_persists_hash_not_raw(db_session, monkeypatch) -> None:
    user = await persist(
        db_session,
        make_user(
            status=OrgUserStatus.PENDING_EMAIL_VERIFICATION,
            instagram_user_id="ig_hash",
        ),
    )
    user.edu_email = "hash@test.edu"
    captured: list[str] = []

    async def _fake_send(
        email: str, token: str, *, org_name: str = "", kind: str = "signup"
    ) -> bool:
        captured.append(token)
        return True

    monkeypatch.setattr(onboarding, "send_verification_email", _fake_send)
    ok = await onboarding._mint_and_send_verification(db_session, user, "hash@test.edu")
    assert ok is True
    assert len(captured) == 1
    raw = captured[0]
    row = await db_session.scalar(
        select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
    )
    assert row is not None
    assert row.token_hash == hash_token(raw)
    assert raw != row.token_hash
