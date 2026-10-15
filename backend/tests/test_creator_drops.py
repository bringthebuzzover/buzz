"""Creator drops fill creator seats and stay off the org tracker."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient

from app.models.creator import Creator
from app.models.enums import PortalRole
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.security.one_shot_tokens import hash_token
from tests.conftest import make_brand, make_org, make_user, mint_access_token, persist

_APPLY = {
    "name": "Ada Lovelace",
    "school": "Cornell",
    "city": "Ithaca",
    "gradYear": "2027",
    "claimedHandle": "ada.creates",
    "niches": ["photo"],
    "bio": "Campus photo essays.",
    "openTo": ["Flat fee"],
}


async def _active_creator(app_client, db_session, email: str) -> User:
    res = await app_client.post(
        "/api/creators/apply",
        json={**_APPLY, "eduEmail": email},
    )
    creator = await db_session.get(Creator, res.json()["data"]["creatorId"])
    token_row = await db_session.scalar(
        __import__("sqlalchemy", fromlist=["select"])
        .select(EmailVerificationToken)
        .where(EmailVerificationToken.user_id == creator.user_id)
    )
    raw = f"tok-{email}"
    token_row.token_hash = hash_token(raw)
    await db_session.flush()
    await app_client.post("/api/creators/verify-email", json={"token": raw})
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    headers = {"Authorization": f"Bearer {mint_access_token(admin)}"}
    await app_client.post(f"/api/admin/creators/{creator.id}/approve", headers=headers)
    user = await db_session.get(User, creator.user_id)

    return user, headers


class TestCreatorDrops:
    async def test_fee_window_and_org_feed(
        self, app_client: AsyncClient, fake_instagram, db_session
    ):
        from sqlalchemy import select

        brand = await make_brand(db_session)
        admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
        headers = {"Authorization": f"Bearer {mint_access_token(admin)}"}
        now = datetime.now(timezone.utc)
        published = await app_client.post(
            "/api/admin/creator-drops",
            json={
                "brandId": str(brand.id),
                "title": "Finals week",
                "description": "Nothing ships.",
                "creatorCap": 1,
                "creatorGross": 300,
                "applyOpenAt": (now - timedelta(days=1)).isoformat(),
                "applyCloseAt": (now + timedelta(days=3)).isoformat(),
            },
            headers=headers,
        )
        assert published.status_code == 200, published.text
        body = published.json()["data"]
        assert body["brand_tracker_stage"] == "request_received"
        assert body["image"] is None
        assert body["audience"] == "creators"
        drop_id = body["id"]

        org = await persist(db_session, make_user(role=PortalRole.ORG))
        await make_org(db_session, org)
        feed = await app_client.get(
            "/api/drops",
            headers={"Authorization": f"Bearer {mint_access_token(org)}"},
        )
        assert feed.status_code == 200
        assert all(item["id"] != drop_id for item in feed.json()["data"])

        org_apply = await app_client.post(
            f"/api/drops/{drop_id}/apply",
            json={"pitch": "nope"},
            headers={"Authorization": f"Bearer {mint_access_token(org)}"},
        )
        assert org_apply.status_code == 400

        res = await app_client.post(
            "/api/creators/apply",
            json={**_APPLY, "eduEmail": "drop@cornell.edu"},
        )
        creator = await db_session.get(Creator, res.json()["data"]["creatorId"])
        token_row = await db_session.scalar(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == creator.user_id)
        )
        token_row.token_hash = hash_token("drop-token")
        await db_session.flush()
        await app_client.post("/api/creators/verify-email", json={"token": "drop-token"})
        early_user = await db_session.get(User, creator.user_id)
        too_soon = await app_client.post(
            f"/api/creators/drops/{drop_id}/apply",
            json={"pitch": "before connect"},
            headers={"Authorization": f"Bearer {mint_access_token(early_user)}"},
        )
        assert too_soon.status_code == 403

        await app_client.post(f"/api/admin/creators/{creator.id}/approve", headers=headers)
        await db_session.refresh(early_user)
        from urllib.parse import parse_qs, urlparse

        fake_instagram.user_id = "ig_drop_creator"
        fake_instagram.username = "dropcreator"
        start = await app_client.post(
            "/api/auth/instagram/bind-start",
            params={"next": "/creators/feed"},
            headers={"Authorization": f"Bearer {mint_access_token(early_user)}"},
        )
        state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
        signed = await app_client.post(
            "/api/auth/instagram/callback",
            json={"code": "c", "state": state},
        )
        assert signed.status_code == 200, signed.text
        token = signed.json()["data"]["access_token"]
        creator_headers = {"Authorization": f"Bearer {token}"}

        listed = await app_client.get("/api/creators/feed", headers=creator_headers)
        card = next(row for row in listed.json()["data"]["drops"] if row["id"] == drop_id)
        assert card["creator_gross"] == 300
        assert card["buzz_fee"] == 60
        assert card["brand_total"] == 360
        assert card["status"] == "open"

        applied = await app_client.post(
            f"/api/creators/drops/{drop_id}/apply",
            json={"pitch": "I would film this."},
            headers=creator_headers,
        )
        assert applied.status_code == 200, applied.text
        again = await app_client.post(
            f"/api/creators/drops/{drop_id}/apply",
            json={"pitch": "again"},
            headers=creator_headers,
        )
        assert again.status_code == 409

        from app.models.application import DropApplication
        from app.models.enums import ApplicationDecision
        from app.services.creator_drops import publish_creator_drop

        closed = await publish_creator_drop(
            db_session,
            brand_id=brand.id,
            title="Closed",
            description="Past.",
            creator_cap=2,
            creator_gross=300,
            apply_open_at=datetime.now(timezone.utc) - timedelta(days=5),
            apply_close_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        closed_apply = await app_client.post(
            f"/api/creators/drops/{closed.id}/apply",
            json={"pitch": "too late"},
            headers=creator_headers,
        )
        assert closed_apply.status_code == 400

        full = await publish_creator_drop(
            db_session,
            brand_id=brand.id,
            title="Full",
            description="One seat.",
            creator_cap=1,
            creator_gross=300,
            apply_open_at=datetime.now(timezone.utc) - timedelta(days=1),
            apply_close_at=datetime.now(timezone.utc) + timedelta(days=2),
        )
        db_session.add(
            DropApplication(
                id=uuid.uuid4(),
                drop_id=full.id,
                creator_id=creator.id,
                decision=ApplicationDecision.ACCEPTED.value,
                pitch="already in",
            )
        )
        await db_session.flush()
        full_apply = await app_client.post(
            f"/api/creators/drops/{full.id}/apply",
            json={"pitch": "no room"},
            headers=creator_headers,
        )
        assert full_apply.status_code == 400
