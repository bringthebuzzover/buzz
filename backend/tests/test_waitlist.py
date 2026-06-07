"""Tests for public waitlist endpoint (architecture.md §9.2)."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import func, select

from app.models.waitlist import Waitlist


class TestWaitlistSubmit:
    async def test_submit_creates_entry(self, app_client: AsyncClient, db_session):
        res = await app_client.post(
            "/api/waitlist",
            json={
                "submitterName": "Jane Doe",
                "entityName": "Acme Corp",
                "email": "jane@acme.com",
                "entityType": "brand",
                "details": "We want to work with campuses",
            },
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert "id" in data

        # Verify DB
        entry = await db_session.scalar(select(Waitlist).where(Waitlist.id == data["id"]))
        assert entry is not None
        assert entry.submitter_name == "Jane Doe"
        assert entry.entity_name == "Acme Corp"
        assert entry.email == "jane@acme.com"
        assert entry.entity_type == "brand"
        assert entry.details == "We want to work with campuses"

    async def test_submit_without_details(self, app_client: AsyncClient):
        res = await app_client.post(
            "/api/waitlist",
            json={
                "submitterName": "John Smith",
                "entityName": "Student Club",
                "email": "john@university.edu",
                "entityType": "org",
            },
        )
        assert res.status_code == 200
        assert "id" in res.json()["data"]

    async def test_no_auth_required(self, app_client: AsyncClient):
        """Waitlist is public — no token needed."""
        res = await app_client.post(
            "/api/waitlist",
            json={
                "submitterName": "No Auth",
                "entityName": "Test",
                "email": "test@test.com",
                "entityType": "org",
            },
        )
        assert res.status_code == 200

    async def test_invalid_entity_type(self, app_client: AsyncClient):
        res = await app_client.post(
            "/api/waitlist",
            json={
                "submitterName": "Bad",
                "entityName": "Test",
                "email": "test@test.com",
                "entityType": "invalid",
            },
        )
        assert res.status_code == 422

    async def test_invalid_email(self, app_client: AsyncClient):
        res = await app_client.post(
            "/api/waitlist",
            json={
                "submitterName": "Bad Email",
                "entityName": "Test",
                "email": "not-an-email",
                "entityType": "org",
            },
        )
        assert res.status_code == 422

    async def test_empty_name_rejected(self, app_client: AsyncClient):
        res = await app_client.post(
            "/api/waitlist",
            json={
                "submitterName": "   ",
                "entityName": "Test",
                "email": "test@test.com",
                "entityType": "org",
            },
        )
        assert res.status_code == 422

    async def test_overlong_name_is_422_not_500(self, app_client: AsyncClient):
        """Regression (found by scripts/bugbash fuzz): an overlong submitter_name
        used to pass validation and 500 on the String(255) DB insert."""
        res = await app_client.post(
            "/api/waitlist",
            json={
                "submitterName": "x" * 500,
                "entityName": "Test",
                "email": "test@test.com",
                "entityType": "org",
            },
        )
        assert res.status_code == 422

    async def test_dedupe_none(self, app_client: AsyncClient, db_session):
        """No deduplication — two identical submissions create two rows."""
        payload = {
            "submitterName": "Duplicate",
            "entityName": "Test",
            "email": "dup@test.com",
            "entityType": "org",
        }
        await app_client.post("/api/waitlist", json=payload)
        await app_client.post("/api/waitlist", json=payload)

        count = await db_session.scalar(
            select(func.count()).select_from(Waitlist).where(Waitlist.email == "dup@test.com")
        )
        assert count == 2
