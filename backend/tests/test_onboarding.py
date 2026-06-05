"""Integration tests for the Stage 7 onboarding surface.

Covers org onboarding (profile submit → email verify → resend) and brand auth
(invite issuance on approval → set-password → login).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy import select

from app.config import settings
from app.models.brand import Brand
from app.models.brand_invite_token import BrandInviteToken
from app.models.enums import BrandStatus, OrgUserStatus, PortalRole
from app.models.organization import Organization
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.security.password import hash_password
from tests.conftest import make_brand, make_user, mint_access_token, persist

# --- Org onboarding: profile submit -----------------------------------------

_VALID_PROFILE = {
    "orgName": "Buzz Club",
    "university": "Test University",
    "eduEmail": "club@test.edu",
    "instagramHandle": "buzzclub",
    "followerCount": 1200,
}


async def test_onboarding_submit_advances_status(app_client: AsyncClient, db_session) -> None:
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_ORG_PROFILE, instagram_user_id="ig_ob_1"),
    )
    resp = await app_client.post(
        "/api/orgs/onboarding",
        json=_VALID_PROFILE,
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["status"] == OrgUserStatus.PENDING_EMAIL_VERIFICATION.value
    assert data["email_sent_to"] == "club@test.edu"

    # Org row + verification token created.
    org = await db_session.scalar(select(Organization).where(Organization.user_id == user.id))
    assert org is not None
    assert org.edu_email == "club@test.edu"
    evt = await db_session.scalar(
        select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
    )
    assert evt is not None


async def test_onboarding_rejects_non_edu_email(app_client: AsyncClient, db_session) -> None:
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_ORG_PROFILE, instagram_user_id="ig_ob_2"),
    )
    resp = await app_client.post(
        "/api/orgs/onboarding",
        json={**_VALID_PROFILE, "eduEmail": "club@gmail.com"},
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 422


async def test_onboarding_rejects_wrong_status(app_client: AsyncClient, db_session) -> None:
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.ACTIVE, instagram_user_id="ig_ob_3"),
    )
    resp = await app_client.post(
        "/api/orgs/onboarding",
        json=_VALID_PROFILE,
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_ONBOARDING_STATE"


async def test_onboarding_requires_auth(app_client: AsyncClient) -> None:
    resp = await app_client.post("/api/orgs/onboarding", json=_VALID_PROFILE)
    assert resp.status_code == 401


# --- Org onboarding: email verification -------------------------------------


async def _seed_pending_verification(
    db_session, *, email: str = "verify@test.edu", suffix: str = "v1"
) -> tuple[User, EmailVerificationToken]:
    user = await persist(
        db_session,
        make_user(
            status=OrgUserStatus.PENDING_EMAIL_VERIFICATION,
            instagram_user_id=f"ig_{suffix}",
        ),
    )
    user.edu_email = email
    token = uuid.uuid4().hex
    evt = EmailVerificationToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token=token,
        email=email,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db_session.add(evt)
    await db_session.flush()
    return user, evt


async def test_verify_email_success(app_client: AsyncClient, db_session) -> None:
    user, evt = await _seed_pending_verification(db_session, suffix="ve1")
    resp = await app_client.post("/api/auth/verify-email", json={"token": evt.token})
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == OrgUserStatus.PENDING_APPROVAL.value

    await db_session.refresh(user)
    assert user.status == OrgUserStatus.PENDING_APPROVAL.value
    assert user.email_verified_at is not None
    await db_session.refresh(evt)
    assert evt.used_at is not None


async def test_verify_email_invalid_token(app_client: AsyncClient) -> None:
    resp = await app_client.post("/api/auth/verify-email", json={"token": "nope"})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VERIFICATION_TOKEN_EXPIRED"


async def test_verify_email_already_used(app_client: AsyncClient, db_session) -> None:
    user, evt = await _seed_pending_verification(db_session, suffix="ve2")
    evt.used_at = datetime.now(timezone.utc)
    await db_session.flush()
    resp = await app_client.post("/api/auth/verify-email", json={"token": evt.token})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "EMAIL_ALREADY_VERIFIED"


async def test_verify_email_expired(app_client: AsyncClient, db_session) -> None:
    user, evt = await _seed_pending_verification(db_session, suffix="ve3")
    evt.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    await db_session.flush()
    resp = await app_client.post("/api/auth/verify-email", json={"token": evt.token})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VERIFICATION_TOKEN_EXPIRED"


# --- Org onboarding: resend --------------------------------------------------


async def test_resend_verification_success(app_client: AsyncClient, db_session) -> None:
    user, _evt = await _seed_pending_verification(db_session, suffix="rs1")
    resp = await app_client.post(
        "/api/auth/verify-email/resend",
        json={},
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 200, resp.text
    tokens = list(
        await db_session.scalars(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
        )
    )
    assert len(tokens) == 2


async def test_resend_rate_limited(app_client: AsyncClient, db_session) -> None:
    user, _evt = await _seed_pending_verification(db_session, suffix="rs2")
    # Already have 1 active token; add 2 more to reach the cap of 3.
    now = datetime.now(timezone.utc)
    for _ in range(2):
        db_session.add(
            EmailVerificationToken(
                id=uuid.uuid4(),
                user_id=user.id,
                token=uuid.uuid4().hex,
                email=user.edu_email,
                expires_at=now + timedelta(hours=24),
            )
        )
    await db_session.flush()
    resp = await app_client.post(
        "/api/auth/verify-email/resend",
        json={},
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "MAX_VERIFICATION_ATTEMPTS"


# --- Brand auth: invite issued on approval ----------------------------------


async def test_approve_brand_issues_invite(app_client: AsyncClient, db_session) -> None:
    brand = await make_brand(db_session, brand_name="Acme")
    brand.status = BrandStatus.PENDING_REVIEW.value
    await db_session.flush()

    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    resp = await app_client.post(
        f"/api/admin/brands/{brand.id}/approve",
        headers={"Authorization": f"Bearer {mint_access_token(admin)}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == BrandStatus.APPROVED.value

    invite = await db_session.scalar(
        select(BrandInviteToken).where(BrandInviteToken.brand_id == brand.id)
    )
    assert invite is not None
    assert invite.used_at is None


# --- Brand auth: set-password -----------------------------------------------


async def _seed_brand_invite(
    db_session, *, used: bool = False, expired: bool = False
) -> tuple[Brand, BrandInviteToken]:
    brand = await make_brand(db_session, brand_name="Acme")
    user = await db_session.get(User, brand.user_id)
    user.status = OrgUserStatus.PENDING_EMAIL_VERIFICATION.value  # not yet active
    now = datetime.now(timezone.utc)
    invite = BrandInviteToken(
        id=uuid.uuid4(),
        user_id=brand.user_id,
        brand_id=brand.id,
        token=uuid.uuid4().hex,
        email=brand.company_email,
        expires_at=now - timedelta(days=1) if expired else now + timedelta(days=7),
        used_at=now if used else None,
    )
    db_session.add(invite)
    await db_session.flush()
    return brand, invite


async def test_brand_set_password_success(app_client: AsyncClient, db_session) -> None:
    brand, invite = await _seed_brand_invite(db_session)
    resp = await app_client.post(
        "/api/auth/brand/set-password",
        json={"token": invite.token, "password": "hunter2pass"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["status"] == OrgUserStatus.ACTIVE.value

    user = await db_session.get(User, brand.user_id)
    assert user.password_hash is not None
    assert user.status == OrgUserStatus.ACTIVE.value
    await db_session.refresh(invite)
    assert invite.used_at is not None


async def test_brand_set_password_short_rejected(app_client: AsyncClient, db_session) -> None:
    _brand, invite = await _seed_brand_invite(db_session)
    resp = await app_client.post(
        "/api/auth/brand/set-password",
        json={"token": invite.token, "password": "short"},
    )
    assert resp.status_code == 422


async def test_brand_set_password_long_ok(app_client: AsyncClient, db_session) -> None:
    """A >72-byte password must not 500 (bcrypt truncates at 72 bytes)."""
    brand, invite = await _seed_brand_invite(db_session)
    resp = await app_client.post(
        "/api/auth/brand/set-password",
        json={"token": invite.token, "password": "a" * 200},
    )
    assert resp.status_code == 200, resp.text
    user = await db_session.get(User, brand.user_id)
    assert user.status == OrgUserStatus.ACTIVE.value


async def test_brand_set_password_unapproved_brand(app_client: AsyncClient, db_session) -> None:
    brand, invite = await _seed_brand_invite(db_session)
    brand.status = BrandStatus.PENDING_REVIEW.value
    await db_session.flush()
    resp = await app_client.post(
        "/api/auth/brand/set-password",
        json={"token": invite.token, "password": "hunter2pass"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_ONBOARDING_STATE"


async def test_brand_set_password_used_token(app_client: AsyncClient, db_session) -> None:
    _brand, invite = await _seed_brand_invite(db_session, used=True)
    resp = await app_client.post(
        "/api/auth/brand/set-password",
        json={"token": invite.token, "password": "hunter2pass"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VERIFICATION_TOKEN_EXPIRED"


async def test_brand_set_password_expired_token(app_client: AsyncClient, db_session) -> None:
    _brand, invite = await _seed_brand_invite(db_session, expired=True)
    resp = await app_client.post(
        "/api/auth/brand/set-password",
        json={"token": invite.token, "password": "hunter2pass"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VERIFICATION_TOKEN_EXPIRED"


# --- Brand auth: login -------------------------------------------------------


async def _seed_active_brand_with_password(
    db_session, *, email: str = "login@test.com", password: str = "hunter2pass"
) -> Brand:
    brand = await make_brand(db_session, brand_name="LoginCo")
    brand.company_email = email
    user = await db_session.get(User, brand.user_id)
    user.password_hash = hash_password(password)
    user.status = OrgUserStatus.ACTIVE.value
    await db_session.flush()
    return brand


async def test_brand_login_success(app_client: AsyncClient, db_session) -> None:
    await _seed_active_brand_with_password(db_session, email="ok@test.com")
    resp = await app_client.post(
        "/api/auth/brand/login",
        json={"email": "ok@test.com", "password": "hunter2pass"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["access_token"]
    assert data["user"]["portal_role"] == PortalRole.BRAND.value
    assert settings.REFRESH_COOKIE_NAME in resp.headers.get("set-cookie", "")


async def test_brand_login_wrong_password(app_client: AsyncClient, db_session) -> None:
    await _seed_active_brand_with_password(db_session, email="wp@test.com")
    resp = await app_client.post(
        "/api/auth/brand/login",
        json={"email": "wp@test.com", "password": "wrongpass1"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_brand_login_unknown_email(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/auth/brand/login",
        json={"email": "ghost@test.com", "password": "whatever12"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_brand_login_unapproved_brand(app_client: AsyncClient, db_session) -> None:
    brand = await _seed_active_brand_with_password(db_session, email="pending@test.com")
    brand.status = BrandStatus.PENDING_REVIEW.value
    await db_session.flush()
    resp = await app_client.post(
        "/api/auth/brand/login",
        json={"email": "pending@test.com", "password": "hunter2pass"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_brand_login_case_insensitive_email(app_client: AsyncClient, db_session) -> None:
    """Login matches the stored company_email case-insensitively."""
    await _seed_active_brand_with_password(db_session, email="Mixed@Test.com")
    resp = await app_client.post(
        "/api/auth/brand/login",
        json={"email": "mixed@test.com", "password": "hunter2pass"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["access_token"]
