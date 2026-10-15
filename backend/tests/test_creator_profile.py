"""A creator can read their own profile and add a portfolio link."""

from __future__ import annotations

from httpx import AsyncClient

from app.models.enums import PortalRole
from tests.conftest import make_user, mint_access_token, persist

_APPLY = {
    "name": "Ada Lovelace",
    "school": "Cornell",
    "city": "Ithaca",
    "gradYear": "2027",
    "eduEmail": "profile@cornell.edu",
    "claimedHandle": "ada.creates",
    "niches": ["photo"],
    "bio": "Campus photo essays.",
    "openTo": ["Flat fee"],
}


class TestCreatorProfile:
    async def test_portfolio_round_trip_is_private(
        self, app_client: AsyncClient, db_session
    ):
        first = await app_client.post("/api/creators/apply", json=_APPLY)
        second = await app_client.post(
            "/api/creators/apply",
            json={**_APPLY, "eduEmail": "other@cornell.edu", "name": "Other"},
        )
        assert first.status_code == 200 and second.status_code == 200
        from app.models.creator import Creator

        owner = await db_session.get(Creator, first.json()["data"]["creatorId"])
        other = await db_session.get(Creator, second.json()["data"]["creatorId"])
        assert owner is not None and other is not None
        from app.models.user import User

        owner_user = await db_session.get(User, owner.user_id)
        other_user = await db_session.get(User, other.user_id)
        assert owner_user is not None and other_user is not None
        headers = {"Authorization": f"Bearer {mint_access_token(owner_user)}"}

        added = await app_client.post(
            "/api/creators/me/portfolio",
            json={"title": "Lookbook", "link": "https://example.com/look"},
            headers=headers,
        )
        assert added.status_code == 200, added.text
        body = added.json()["data"]
        assert body["gradYear"] == "2027"
        assert body["pastCollab"] is None
        assert body["followers"] is None
        assert body["posts"] is None
        item = body["portfolio"][0]
        assert item["title"] == "Lookbook"
        assert item["link"] == "https://example.com/look"
        assert item["imageUrl"] is None

        mine = await app_client.get("/api/creators/me", headers=headers)
        assert mine.json()["data"]["id"] == str(owner.id)
        assert len(mine.json()["data"]["portfolio"]) == 1

        theirs = await app_client.get(
            "/api/creators/me",
            headers={"Authorization": f"Bearer {mint_access_token(other_user)}"},
        )
        assert theirs.json()["data"]["id"] == str(other.id)
        assert theirs.json()["data"]["portfolio"] == []

        org = await persist(db_session, make_user(role=PortalRole.ORG))
        forbidden = await app_client.post(
            "/api/creators/me/portfolio",
            json={"title": "Nope"},
            headers={"Authorization": f"Bearer {mint_access_token(org)}"},
        )
        assert forbidden.status_code == 403
