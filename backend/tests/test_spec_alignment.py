"""Stage 10 — PRODUCT.md alignment gaps (backend slices).

Covers the server-side of four gaps closed against PRODUCT.md:
* §6.3.1 — Notify-Me state round-trips on the org feed.
* §5.2   — tracking number stored on the drop at awaiting_products.
* §5.3.1 — individual posts grouped by org in the brand per-drop view.
* §5.3.1 — org category persisted via onboarding + surfaced to the brand.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy import select

from app.models.enums import (
    ApplicationDecision,
    BrandTrackerStage,
    OrgCategory,
    OrgUserStatus,
    PortalRole,
)
from app.models.organization import Organization
from tests.conftest import (
    make_application,
    make_brand,
    make_drop,
    make_notify,
    make_org,
    make_post_link,
    make_social_post,
    make_user,
    mint_access_token,
    persist,
)


async def _org_ctx(db_session, *, instagram_user_id: str = "ig_align"):
    """Active org user + org profile + auth headers."""
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.ACTIVE, instagram_user_id=instagram_user_id),
    )
    org = await make_org(db_session, user)
    headers = {"Authorization": f"Bearer {mint_access_token(user)}"}
    return user, org, headers


async def _brand_ctx(db_session):
    brand_user = await persist(db_session, make_user(role=PortalRole.BRAND))
    brand = await make_brand(db_session)
    brand.user_id = brand_user.id
    await db_session.flush()
    headers = {"Authorization": f"Bearer {mint_access_token(brand_user)}"}
    return brand_user, brand, headers


async def _admin_headers(db_session):
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


# --- Gap 2: Notify-Me feed round-trip (§6.3.1) -------------------------------


async def test_feed_surfaces_notify_state(app_client: AsyncClient, db_session) -> None:
    _, org, headers = await _org_ctx(db_session)
    brand = await make_brand(db_session)
    now = datetime.now(timezone.utc)
    subscribed = await make_drop(
        db_session, brand, title="Subscribed", apply_open_at=now + timedelta(days=2)
    )
    other = await make_drop(
        db_session, brand, title="NoNotify", apply_open_at=now + timedelta(days=2)
    )
    await make_notify(db_session, org, subscribed, reminder_minutes=60)

    resp = await app_client.get("/api/drops", headers=headers)
    assert resp.status_code == 200
    by_id = {d["id"]: d for d in resp.json()["data"]}

    sub = by_id[str(subscribed.id)]
    assert sub["notifyRequested"] is True
    assert sub["reminderMinutes"] == 60

    non = by_id[str(other.id)]
    assert non["notifyRequested"] is False
    assert non["reminderMinutes"] is None


async def test_feed_notify_state_is_per_org(app_client: AsyncClient, db_session) -> None:
    """One org's notify subscription must not leak into another org's feed."""
    _, org_a, _ = await _org_ctx(db_session, instagram_user_id="ig_a")
    _, _, headers_b = await _org_ctx(db_session, instagram_user_id="ig_b")
    brand = await make_brand(db_session)
    drop = await make_drop(
        db_session, brand, apply_open_at=datetime.now(timezone.utc) + timedelta(days=2)
    )
    await make_notify(db_session, org_a, drop, reminder_minutes=15)

    resp = await app_client.get("/api/drops", headers=headers_b)
    item = next(d for d in resp.json()["data"] if d["id"] == str(drop.id))
    assert item["notifyRequested"] is False
    assert item["reminderMinutes"] is None


# --- Gap 3: tracking number on the drop at awaiting_products (§5.2) -----------


async def test_advance_to_awaiting_sets_drop_tracking_number(
    app_client: AsyncClient, db_session
) -> None:
    brand = await make_brand(db_session)
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.AWAITING_PRODUCTS)
    # Advance into awaiting_products is forward-only; start one stage back.
    drop.brand_tracker_stage = BrandTrackerStage.FINALIZING_AGREEMENTS.value
    await db_session.flush()

    resp = await app_client.patch(
        f"/api/admin/drops/{drop.id}/tracker",
        json={"stage": "awaiting_products", "trackingNumber": "1Z-TEST-999"},
        headers=await _admin_headers(db_session),
    )
    assert resp.status_code == 200, resp.text
    await db_session.refresh(drop)
    assert drop.tracking_number == "1Z-TEST-999"


async def test_brand_drop_detail_exposes_tracking_number(
    app_client: AsyncClient, db_session
) -> None:
    _, brand, headers = await _brand_ctx(db_session)
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.AWAITING_PRODUCTS)
    drop.tracking_number = "TRACK-123"
    await db_session.flush()

    resp = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["trackingNumber"] == "TRACK-123"


# --- Gap 5: per-post listing grouped by org (§5.3.1) -------------------------


async def test_brand_drop_detail_includes_org_posts(app_client: AsyncClient, db_session) -> None:
    _, brand, headers = await _brand_ctx(db_session)
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_ACTIVE)
    org_user = await persist(db_session, make_user(instagram_user_id="ig_poster"))
    org = await make_org(db_session, org_user, org_name="Poster Org")
    application = await make_application(
        db_session, drop, org, decision=ApplicationDecision.ACCEPTED
    )
    post = await make_social_post(db_session, org, caption="hype", likes=42, comments=7)
    await make_post_link(db_session, post, application)

    resp = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=headers)
    assert resp.status_code == 200
    applicant = next(a for a in resp.json()["data"]["applications"] if a["orgId"] == str(org.id))
    assert len(applicant["posts"]) == 1
    p = applicant["posts"][0]
    assert p["id"] == str(post.id)
    assert p["likes"] == 42
    assert p["comments"] == 7
    assert p["url"] == post.url


async def test_brand_drop_detail_org_with_no_posts(app_client: AsyncClient, db_session) -> None:
    _, brand, headers = await _brand_ctx(db_session)
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.DROP_ACTIVE)
    org_user = await persist(db_session, make_user(instagram_user_id="ig_noposts"))
    org = await make_org(db_session, org_user)
    await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)

    resp = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=headers)
    applicant = next(a for a in resp.json()["data"]["applications"] if a["orgId"] == str(org.id))
    assert applicant["posts"] == []


# --- Gap 6: org category persisted + surfaced (§5.3.1) -----------------------


async def test_onboarding_persists_category(app_client: AsyncClient, db_session) -> None:
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_ORG_PROFILE, instagram_user_id="ig_cat"),
    )
    resp = await app_client.post(
        "/api/orgs/onboarding",
        json={
            "orgName": "Sigma Club",
            "university": "Test University",
            "eduEmail": "sigma@test.edu",
            "instagramHandle": "sigmaclub",
            "category": "sorority",
        },
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 200, resp.text
    org = await db_session.scalar(select(Organization).where(Organization.user_id == user.id))
    assert org is not None
    assert org.category == OrgCategory.SORORITY.value


async def test_onboarding_rejects_invalid_category(app_client: AsyncClient, db_session) -> None:
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.PENDING_ORG_PROFILE, instagram_user_id="ig_badcat"),
    )
    resp = await app_client.post(
        "/api/orgs/onboarding",
        json={
            "orgName": "X",
            "university": "Y",
            "eduEmail": "x@test.edu",
            "instagramHandle": "x",
            "category": "not-a-real-category",
        },
        headers={"Authorization": f"Bearer {mint_access_token(user)}"},
    )
    assert resp.status_code == 422


async def test_brand_drop_detail_includes_org_category(app_client: AsyncClient, db_session) -> None:
    _, brand, headers = await _brand_ctx(db_session)
    drop = await make_drop(db_session, brand, stage=BrandTrackerStage.FINALIZING_AGREEMENTS)
    org_user = await persist(db_session, make_user(instagram_user_id="ig_catorg"))
    org = await make_org(db_session, org_user)
    org.category = OrgCategory.SPORTS.value
    await db_session.flush()
    await make_application(db_session, drop, org)

    resp = await app_client.get(f"/api/brands/me/drops/{drop.id}", headers=headers)
    applicant = next(a for a in resp.json()["data"]["applications"] if a["orgId"] == str(org.id))
    assert applicant["category"] == "sports"


async def test_org_profile_returns_category(app_client: AsyncClient, db_session) -> None:
    _, org, headers = await _org_ctx(db_session, instagram_user_id="ig_meprofile")
    org.category = OrgCategory.ACADEMIC.value
    await db_session.flush()

    resp = await app_client.get("/api/orgs/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["category"] == "academic"


async def test_org_profile_patch_updates_category(app_client: AsyncClient, db_session) -> None:
    """PATCH /api/orgs/me persists category and round-trips as the bare string."""
    _, org, headers = await _org_ctx(db_session, instagram_user_id="ig_patchcat")

    resp = await app_client.patch("/api/orgs/me", json={"category": "social"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["category"] == "social"
    await db_session.refresh(org)
    assert org.category == OrgCategory.SOCIAL.value
