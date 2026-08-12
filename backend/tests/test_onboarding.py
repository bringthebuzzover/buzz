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
from app.security.one_shot_tokens import hash_token
from app.security.password import hash_password
from tests.conftest import make_brand, make_user, mint_access_token, persist

# --- Org onboarding: profile submit -----------------------------------------

_VALID_PROFILE = {
    "orgName": "Buzz Club",
    "university": "Test University",
    "eduEmail": "club@test.edu",
    "memberCount": 40,
    "category": "social",
    "city": "Ithaca",
    "state": "NY",
    "contactName": "Casey Officer",
    "deliveryAddress": "123 Campus Rd, Ithaca, NY 14850",
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
    assert data["emailSentTo"] == "club@test.edu"
    assert data["emailSent"] is True

    # Org row + verification token created; identity lives on the user.
    org = await db_session.scalar(select(Organization).where(Organization.user_id == user.id))
    assert org is not None
    await db_session.refresh(user)
    assert user.edu_email == "club@test.edu"
    assert user.instagram_username is not None
    evt = await db_session.scalar(
        select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
    )
    assert evt is not None


async def test_onboarding_rejects_client_instagram_handle(
    app_client: AsyncClient, db_session
) -> None:
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_ORG_PROFILE, instagram_user_id="ig_ob_handle"),
    )
    resp = await app_client.post(
        "/api/orgs/onboarding",
        json={**_VALID_PROFILE, "instagramHandle": "someoneelse"},
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


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


async def test_onboarding_duplicate_edu_email_conflict(app_client: AsyncClient, db_session) -> None:
    # An existing account already owns this .edu email (verified).
    existing = await persist(
        db_session,
        make_user(status=OrgUserStatus.ACTIVE, instagram_user_id="ig_dup_existing"),
    )
    existing.edu_email = "club@test.edu"
    existing.email_verified_at = datetime.now(timezone.utc)
    await db_session.flush()

    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_ORG_PROFILE, instagram_user_id="ig_dup_new"),
    )
    resp = await app_client.post(
        "/api/orgs/onboarding",
        json=_VALID_PROFILE,  # eduEmail = club@test.edu
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "EDU_EMAIL_TAKEN"


async def test_onboarding_takeover_stale_unverified_edu(
    app_client: AsyncClient, db_session
) -> None:
    peer = await persist(
        db_session,
        make_user(
            status=OrgUserStatus.PENDING_EMAIL_VERIFICATION,
            instagram_user_id="ig_stale_peer",
        ),
    )
    peer.edu_email = "club@test.edu"
    org = Organization(
        id=uuid.uuid4(),
        user_id=peer.id,
        org_name="Stale Club",
        university="Test University",
        created_at=datetime.now(timezone.utc)
        - timedelta(hours=settings.EDU_EMAIL_UNVERIFIED_CLAIM_TTL_HOURS + 1),
    )
    db_session.add(org)
    await db_session.flush()

    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_ORG_PROFILE, instagram_user_id="ig_takeover"),
    )
    resp = await app_client.post(
        "/api/orgs/onboarding",
        json=_VALID_PROFILE,
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 200, resp.text
    await db_session.refresh(peer)
    assert peer.edu_email is None


async def test_change_edu_email_while_pending(app_client: AsyncClient, db_session) -> None:
    user, evt, _raw = await _seed_pending_verification(
        db_session, email="old@test.edu", suffix="chg1"
    )
    org = Organization(
        id=uuid.uuid4(),
        user_id=user.id,
        org_name="Change Club",
        university="Test University",
    )
    db_session.add(org)
    await db_session.flush()

    resp = await app_client.post(
        "/api/auth/verify-email/change",
        json={"eduEmail": "new@test.edu"},
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["emailSentTo"] == "new@test.edu"
    await db_session.refresh(user)
    await db_session.refresh(evt)
    assert user.edu_email == "new@test.edu"
    assert evt.expires_at <= datetime.now(timezone.utc)


async def test_onboarding_rejects_unknown_field(app_client: AsyncClient, db_session) -> None:
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_ORG_PROFILE, instagram_user_id="ig_extra"),
    )
    resp = await app_client.post(
        "/api/orgs/onboarding",
        json={**_VALID_PROFILE, "bogusField": "x"},
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 422


async def test_onboarding_rejects_client_follower_count(
    app_client: AsyncClient, db_session
) -> None:
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_ORG_PROFILE, instagram_user_id="ig_followers"),
    )
    resp = await app_client.post(
        "/api/orgs/onboarding",
        json={**_VALID_PROFILE, "followerCount": 1200},
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_onboarding_requires_profile_fields(app_client: AsyncClient, db_session) -> None:
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_ORG_PROFILE, instagram_user_id="ig_req"),
    )
    minimal = {
        "orgName": "Buzz Club",
        "university": "Test University",
        "eduEmail": "club@test.edu",
    }
    resp = await app_client.post(
        "/api/orgs/onboarding",
        json=minimal,
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 422


async def test_seed_follower_count_from_graph_helper(db_session, fake_instagram) -> None:
    """Create-time Graph seed writes followers; no HTTP (avoids token-refresh middleware)."""
    from app.security.token_crypto import encrypt_token
    from app.services.onboarding import _seed_follower_count_from_graph

    fake_instagram.followers_count = 4242
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_ORG_PROFILE, instagram_user_id="ig_seed"),
    )
    user.instagram_access_token = encrypt_token("fake-long-lived")
    user.instagram_token_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    org = await persist(
        db_session,
        Organization(
            id=uuid.uuid4(),
            user_id=user.id,
            org_name="Seed Club",
            university="Test University",
            follower_count=None,
            member_count=10,
            category="social",
            city="Ithaca",
            state="NY",
            contact_name="Casey",
            delivery_address="1 Main",
        ),
    )
    await _seed_follower_count_from_graph(org, user, fake_instagram)
    await db_session.flush()
    await db_session.refresh(org)
    assert org.follower_count == 4242


# --- Org onboarding: email verification -------------------------------------


async def _seed_pending_verification(
    db_session, *, email: str = "verify@test.edu", suffix: str = "v1"
) -> tuple[User, EmailVerificationToken, str]:
    user = await persist(
        db_session,
        make_user(
            status=OrgUserStatus.PENDING_EMAIL_VERIFICATION,
            instagram_user_id=f"ig_{suffix}",
        ),
    )
    user.edu_email = email
    raw = uuid.uuid4().hex
    evt = EmailVerificationToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hash_token(raw),
        email=email,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db_session.add(evt)
    await db_session.flush()
    return user, evt, raw


async def test_verify_email_success(app_client: AsyncClient, db_session) -> None:
    user, evt, raw = await _seed_pending_verification(db_session, suffix="ve1")
    resp = await app_client.post("/api/auth/verify-email", json={"token": raw})
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
    assert resp.json()["error"]["code"] == "VERIFICATION_TOKEN_INVALID"


async def test_verify_email_already_used(app_client: AsyncClient, db_session) -> None:
    user, evt, raw = await _seed_pending_verification(db_session, suffix="ve2")
    evt.used_at = datetime.now(timezone.utc)
    await db_session.flush()
    resp = await app_client.post("/api/auth/verify-email", json={"token": raw})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "EMAIL_ALREADY_VERIFIED"


async def test_verify_email_expired(app_client: AsyncClient, db_session) -> None:
    user, evt, raw = await _seed_pending_verification(db_session, suffix="ve3")
    evt.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    await db_session.flush()
    resp = await app_client.post("/api/auth/verify-email", json={"token": raw})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VERIFICATION_TOKEN_EXPIRED"


# --- Org onboarding: resend --------------------------------------------------


async def test_resend_verification_success(app_client: AsyncClient, db_session) -> None:
    user, _evt, _raw = await _seed_pending_verification(db_session, suffix="rs1")
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
    user, _evt, _raw = await _seed_pending_verification(db_session, suffix="rs2")
    # Already have 1 active token; add 2 more to reach the cap of 3.
    now = datetime.now(timezone.utc)
    for _ in range(2):
        db_session.add(
            EmailVerificationToken(
                id=uuid.uuid4(),
                user_id=user.id,
                token_hash=hash_token(uuid.uuid4().hex),
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


async def test_resend_email_send_failed_does_not_burn_token(
    app_client: AsyncClient, db_session, monkeypatch
) -> None:
    user, _evt, _raw = await _seed_pending_verification(db_session, suffix="rs_fail")

    async def _fail(*args, **kwargs):
        return False

    monkeypatch.setattr("app.services.onboarding.send_verification_email", _fail)
    before = list(
        await db_session.scalars(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
        )
    )
    assert len(before) == 1

    resp = await app_client.post(
        "/api/auth/verify-email/resend",
        json={},
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "EMAIL_SEND_FAILED"

    await db_session.refresh(user)
    after = list(
        await db_session.scalars(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
        )
    )
    # Raise rolls back the mint; original token remains the only live one.
    assert len(after) == 1
    assert after[0].id == before[0].id


async def test_onboarding_submit_email_sent_false_keeps_profile(
    app_client: AsyncClient, db_session, monkeypatch
) -> None:
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_ORG_PROFILE, instagram_user_id="ig_ob_esf"),
    )

    async def _fail(*args, **kwargs):
        return False

    monkeypatch.setattr("app.services.onboarding.send_verification_email", _fail)
    resp = await app_client.post(
        "/api/orgs/onboarding",
        json={**_VALID_PROFILE, "eduEmail": "failmail@test.edu"},
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["emailSent"] is False
    assert data["status"] == OrgUserStatus.PENDING_EMAIL_VERIFICATION.value

    await db_session.refresh(user)
    assert user.edu_email == "failmail@test.edu"
    assert user.status == OrgUserStatus.PENDING_EMAIL_VERIFICATION.value
    org = await db_session.scalar(select(Organization).where(Organization.user_id == user.id))
    assert org is not None
    tokens = list(
        await db_session.scalars(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
        )
    )
    assert tokens == []


# --- Brand self-registration (Phase 1) --------------------------------------


async def test_brand_apply_creates_pending_brand(app_client: AsyncClient, db_session) -> None:
    resp = await app_client.post(
        "/api/brands/apply",
        json={
            "brandName": "Acme Co",
            "companyEmail": "Hello@Acme.com",
            "instagramHandle": "@acme",
            "intentMessage": "We want campus reach.",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["status"] == BrandStatus.PENDING_REVIEW.value

    brand = await db_session.scalar(select(Brand).where(Brand.company_email == "hello@acme.com"))
    assert brand is not None
    assert brand.instagram_handle == "acme" or brand.instagram_handle == "@acme"
    user = await db_session.get(User, brand.user_id)
    assert user.portal_role == PortalRole.BRAND.value
    assert user.status != OrgUserStatus.ACTIVE.value
    assert user.password_hash is None


async def test_brand_apply_duplicate_email_conflict(app_client: AsyncClient, db_session) -> None:
    await make_brand(db_session, brand_name="Existing", company_email="brand@test.com")
    resp = await app_client.post(
        "/api/brands/apply",
        json={"brandName": "Dup", "companyEmail": "BRAND@test.com"},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "BRAND_EMAIL_TAKEN"


async def test_brand_apply_disabled_returns_403(
    app_client: AsyncClient, db_session, monkeypatch
) -> None:
    from app.config import settings as app_settings

    monkeypatch.setattr(app_settings, "BRAND_SELF_REGISTRATION_ENABLED", False)
    resp = await app_client.post(
        "/api/brands/apply",
        json={"brandName": "Nope", "companyEmail": "nope@brand.com"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "BRAND_REGISTRATION_DISABLED"


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


async def test_deny_brand_sets_denied(app_client: AsyncClient, db_session) -> None:
    brand = await make_brand(db_session, brand_name="Acme")
    brand.status = BrandStatus.PENDING_REVIEW.value
    user = await db_session.get(User, brand.user_id)
    assert user is not None
    user.status = OrgUserStatus.PENDING_APPROVAL.value
    await db_session.flush()

    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    resp = await app_client.post(
        f"/api/admin/brands/{brand.id}/deny",
        headers={"Authorization": f"Bearer {mint_access_token(admin)}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == BrandStatus.DENIED.value

    await db_session.refresh(user)
    assert user.status == OrgUserStatus.DENIED.value

    # No invite token issued on denial.
    invite = await db_session.scalar(
        select(BrandInviteToken).where(BrandInviteToken.brand_id == brand.id)
    )
    assert invite is None


# --- Brand auth: set-password -----------------------------------------------


async def _seed_brand_invite(
    db_session, *, used: bool = False, expired: bool = False
) -> tuple[Brand, BrandInviteToken, str]:
    brand = await make_brand(db_session, brand_name="Acme")
    user = await db_session.get(User, brand.user_id)
    user.status = OrgUserStatus.PENDING_EMAIL_VERIFICATION.value  # not yet active
    now = datetime.now(timezone.utc)
    raw = uuid.uuid4().hex
    invite = BrandInviteToken(
        id=uuid.uuid4(),
        user_id=brand.user_id,
        brand_id=brand.id,
        token_hash=hash_token(raw),
        email=brand.company_email,
        expires_at=now - timedelta(days=1) if expired else now + timedelta(days=7),
        used_at=now if used else None,
    )
    db_session.add(invite)
    await db_session.flush()
    return brand, invite, raw


async def test_brand_set_password_success(app_client: AsyncClient, db_session) -> None:
    brand, invite, raw = await _seed_brand_invite(db_session)
    resp = await app_client.post(
        "/api/auth/brand/set-password",
        json={"token": raw, "password": "hunter2pass"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    # set-password now starts a session (TokenResponse), no separate login.
    assert data["access_token"]
    assert data["user"]["status"] == OrgUserStatus.ACTIVE.value
    assert settings.REFRESH_COOKIE_NAME in resp.headers.get("set-cookie", "")

    user = await db_session.get(User, brand.user_id)
    assert user.password_hash is not None
    assert user.status == OrgUserStatus.ACTIVE.value
    await db_session.refresh(invite)
    assert invite.used_at is not None


async def test_brand_set_password_short_rejected(app_client: AsyncClient, db_session) -> None:
    _brand, invite, raw = await _seed_brand_invite(db_session)
    resp = await app_client.post(
        "/api/auth/brand/set-password",
        json={"token": raw, "password": "short"},
    )
    assert resp.status_code == 422


async def test_brand_set_password_long_ok(app_client: AsyncClient, db_session) -> None:
    """A >72-byte password must not 500 (bcrypt truncates at 72 bytes)."""
    brand, invite, raw = await _seed_brand_invite(db_session)
    resp = await app_client.post(
        "/api/auth/brand/set-password",
        json={"token": raw, "password": "a" * 200},
    )
    assert resp.status_code == 200, resp.text
    user = await db_session.get(User, brand.user_id)
    assert user.status == OrgUserStatus.ACTIVE.value


async def test_brand_set_password_unapproved_brand(app_client: AsyncClient, db_session) -> None:
    brand, invite, raw = await _seed_brand_invite(db_session)
    brand.status = BrandStatus.PENDING_REVIEW.value
    await db_session.flush()
    resp = await app_client.post(
        "/api/auth/brand/set-password",
        json={"token": raw, "password": "hunter2pass"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_ONBOARDING_STATE"


async def test_brand_set_password_used_token(app_client: AsyncClient, db_session) -> None:
    _brand, invite, raw = await _seed_brand_invite(db_session, used=True)
    resp = await app_client.post(
        "/api/auth/brand/set-password",
        json={"token": raw, "password": "hunter2pass"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VERIFICATION_TOKEN_USED"


async def test_brand_set_password_expired_token(app_client: AsyncClient, db_session) -> None:
    _brand, invite, raw = await _seed_brand_invite(db_session, expired=True)
    resp = await app_client.post(
        "/api/auth/brand/set-password",
        json={"token": raw, "password": "hunter2pass"},
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


# --- Post-verify .edu pending-swap rotate ------------------------------------


async def _seed_verified_org(
    db_session,
    *,
    email: str,
    suffix: str,
    status: OrgUserStatus = OrgUserStatus.ACTIVE,
) -> User:
    user = await persist(
        db_session,
        make_user(status=status, instagram_user_id=f"ig_rot_{suffix}"),
    )
    user.edu_email = email
    user.email_verified_at = datetime.now(timezone.utc)
    db_session.add(
        Organization(
            id=uuid.uuid4(),
            user_id=user.id,
            org_name=f"Rotate Club {suffix}",
            university="Test University",
        )
    )
    await db_session.flush()
    return user


async def test_rotate_edu_email_pending_swap_then_verify(
    app_client: AsyncClient, db_session
) -> None:
    user = await _seed_verified_org(db_session, email="live@test.edu", suffix="r1")
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}

    resp = await app_client.post(
        "/api/auth/verify-email/rotate",
        json={"eduEmail": "new@test.edu"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()["data"]
    assert body["emailSentTo"] == "new@test.edu"
    assert body["pendingEduEmail"] == "new@test.edu"
    assert body["status"] == OrgUserStatus.ACTIVE.value

    await db_session.refresh(user)
    assert user.edu_email == "live@test.edu"
    assert user.pending_edu_email == "new@test.edu"
    assert user.status == OrgUserStatus.ACTIVE.value

    tokens = list(
        await db_session.scalars(
            select(EmailVerificationToken).where(
                EmailVerificationToken.user_id == user.id,
                EmailVerificationToken.used_at.is_(None),
            )
        )
    )
    assert len(tokens) == 1
    assert tokens[0].email == "new@test.edu"

    # Recover raw token from mint helper path: re-mint isn't exposed; use
    # service mint by reading hash isn't reversible. Seed a known token instead.
    raw = uuid.uuid4().hex
    tokens[0].token_hash = hash_token(raw)
    await db_session.flush()

    verify = await app_client.post("/api/auth/verify-email", json={"token": raw})
    assert verify.status_code == 200, verify.text
    assert verify.json()["data"]["status"] == OrgUserStatus.ACTIVE.value

    await db_session.refresh(user)
    assert user.edu_email == "new@test.edu"
    assert user.pending_edu_email is None
    assert user.email_verified_at is not None
    assert user.status == OrgUserStatus.ACTIVE.value


async def test_rotate_edu_email_pending_approval_eligible(
    app_client: AsyncClient, db_session
) -> None:
    user = await _seed_verified_org(
        db_session,
        email="pend@test.edu",
        suffix="r2",
        status=OrgUserStatus.PENDING_APPROVAL,
    )
    resp = await app_client.post(
        "/api/auth/verify-email/rotate",
        json={"eduEmail": "pend-new@test.edu"},
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 200, resp.text
    await db_session.refresh(user)
    assert user.edu_email == "pend@test.edu"
    assert user.pending_edu_email == "pend-new@test.edu"
    assert user.status == OrgUserStatus.PENDING_APPROVAL.value


async def test_rotate_rejects_onboarding_only_change_path(
    app_client: AsyncClient, db_session
) -> None:
    """POST /verify-email/change stays onboarding-only (typo fix)."""
    user = await _seed_verified_org(db_session, email="keep@test.edu", suffix="r3")
    resp = await app_client.post(
        "/api/auth/verify-email/change",
        json={"eduEmail": "typo@test.edu"},
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_ONBOARDING_STATE"
    await db_session.refresh(user)
    assert user.edu_email == "keep@test.edu"
    assert user.pending_edu_email is None


async def test_cancel_pending_edu_email(app_client: AsyncClient, db_session) -> None:
    user = await _seed_verified_org(db_session, email="cancel@test.edu", suffix="r4")
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    await app_client.post(
        "/api/auth/verify-email/rotate",
        json={"eduEmail": "cancel-new@test.edu"},
        headers=headers,
    )
    raw = uuid.uuid4().hex
    evt = (
        await db_session.scalars(
            select(EmailVerificationToken).where(
                EmailVerificationToken.user_id == user.id,
                EmailVerificationToken.used_at.is_(None),
            )
        )
    ).first()
    assert evt is not None
    evt.token_hash = hash_token(raw)
    await db_session.flush()

    resp = await app_client.post(
        "/api/auth/verify-email/cancel",
        json={},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    await db_session.refresh(user)
    assert user.pending_edu_email is None
    await db_session.refresh(evt)
    assert evt.expires_at <= datetime.now(timezone.utc)

    verify = await app_client.post("/api/auth/verify-email", json={"token": raw})
    assert verify.status_code == 400


async def test_resend_pending_swap(app_client: AsyncClient, db_session) -> None:
    user = await _seed_verified_org(db_session, email="rs@test.edu", suffix="r5")
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    await app_client.post(
        "/api/auth/verify-email/rotate",
        json={"eduEmail": "rs-new@test.edu"},
        headers=headers,
    )
    before = list(
        await db_session.scalars(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
        )
    )
    assert len(before) == 1

    resp = await app_client.post(
        "/api/auth/verify-email/resend",
        json={},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["emailSentTo"] == "rs-new@test.edu"
    after = list(
        await db_session.scalars(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
        )
    )
    assert len(after) == 2


async def test_rotate_blocks_live_and_pending_collisions(
    app_client: AsyncClient, db_session
) -> None:
    await _seed_verified_org(db_session, email="taken@test.edu", suffix="r6a")
    peer = await _seed_verified_org(db_session, email="peer@test.edu", suffix="r6b")
    peer.pending_edu_email = "pending-taken@test.edu"
    await db_session.flush()

    user = await _seed_verified_org(db_session, email="me@test.edu", suffix="r6c")
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}

    live = await app_client.post(
        "/api/auth/verify-email/rotate",
        json={"eduEmail": "taken@test.edu"},
        headers=headers,
    )
    assert live.status_code == 409
    assert live.json()["error"]["code"] == "EDU_EMAIL_TAKEN"

    pending = await app_client.post(
        "/api/auth/verify-email/rotate",
        json={"eduEmail": "pending-taken@test.edu"},
        headers=headers,
    )
    assert pending.status_code == 409
    assert pending.json()["error"]["code"] == "EDU_EMAIL_TAKEN"


async def test_me_exposes_pending_edu_email(app_client: AsyncClient, db_session) -> None:
    user = await _seed_verified_org(db_session, email="me-live@test.edu", suffix="r7")
    user.pending_edu_email = "me-pend@test.edu"
    await db_session.flush()
    resp = await app_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["email"] == "me-live@test.edu"
    assert data["pending_edu_email"] == "me-pend@test.edu"
