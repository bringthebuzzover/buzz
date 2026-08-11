"""Tests for the admin panel's read endpoints (``/api/admin`` GETs).

Covers the role gate on every new route, the status/stage/attention filters, and
the signal definitions on the overview and health payloads. The signal tests are
the important ones: each asserts that a *specific* broken state from
``gaps/`` is counted, so a refactor that silently drops one fails here.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient

from app.models.brand_invite_token import BrandInviteToken
from app.models.enums import (
    ApplicationDecision,
    BrandStatus,
    BrandTrackerStage,
    OrgUserStatus,
    PortalRole,
    SocialMediaProductType,
)
from tests.conftest import (
    make_application,
    make_brand,
    make_drop,
    make_notify,
    make_org,
    make_social_post,
    make_suggestion,
    make_tracker_event,
    make_user,
    mint_access_token,
    persist,
)


async def _admin_headers(db_session) -> dict:
    admin = await persist(db_session, make_user(role=PortalRole.ADMIN))
    return {"Authorization": f"Bearer {mint_access_token(admin)}"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _signal(payload: dict, group: str, key: str) -> dict:
    """Pull one signal out of a health group by key."""
    return next(item for item in payload[group] if item["key"] == key)


def _queue(payload: dict, key: str) -> dict:
    return next(item for item in payload["queues"] if item["key"] == key)


def _warning(payload: dict, key: str) -> dict | None:
    return next((item for item in payload["warnings"] if item["key"] == key), None)


READ_ROUTES = [
    "/api/admin/overview",
    "/api/admin/health",
    "/api/admin/orgs",
    "/api/admin/brands",
    "/api/admin/drops",
]


class TestPanelGate:
    async def test_non_admin_forbidden(self, app_client: AsyncClient, db_session):
        org_user = await persist(db_session, make_user(role=PortalRole.ORG))
        headers = {"Authorization": f"Bearer {mint_access_token(org_user)}"}
        for route in READ_ROUTES:
            res = await app_client.get(route, headers=headers)
            assert res.status_code == 403, route

    async def test_unauthorized(self, app_client: AsyncClient):
        for route in READ_ROUTES:
            res = await app_client.get(route)
            assert res.status_code == 401, route


class TestOrgList:
    async def test_includes_profileless_users(self, app_client: AsyncClient, db_session):
        """A ``pending_org_profile`` user has no ``organizations`` row; the outer
        join must still surface them so an abandoned signup is visible."""
        await persist(
            db_session,
            make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_ORG_PROFILE),
        )

        res = await app_client.get("/api/admin/orgs", headers=await _admin_headers(db_session))
        assert res.status_code == 200
        rows = res.json()["data"]
        assert len(rows) == 1
        assert rows[0]["id"] is None
        assert rows[0]["orgName"] is None
        assert rows[0]["status"] == "pending_org_profile"

    async def test_status_filter(self, app_client: AsyncClient, db_session):
        active = await persist(
            db_session, make_user(role=PortalRole.ORG, status=OrgUserStatus.ACTIVE)
        )
        await make_org(db_session, active, org_name="Active Org")
        pending = await persist(
            db_session,
            make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_APPROVAL),
        )
        await make_org(db_session, pending, org_name="Pending Org")

        headers = await _admin_headers(db_session)
        res = await app_client.get("/api/admin/orgs?status=active", headers=headers)
        assert [r["orgName"] for r in res.json()["data"]] == ["Active Org"]

        res = await app_client.get("/api/admin/orgs", headers=headers)
        assert len(res.json()["data"]) == 2

    async def test_unknown_status_rejected(self, app_client: AsyncClient, db_session):
        res = await app_client.get(
            "/api/admin/orgs?status=not_a_status", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"

    async def test_pending_route_still_narrow(self, app_client: AsyncClient, db_session):
        """``/orgs/pending`` shares the generalized query but keeps its own
        schema, and must drop profileless rows rather than 500."""
        await persist(
            db_session,
            make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_APPROVAL),
        )  # no profile
        user = await persist(
            db_session,
            make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_APPROVAL),
        )
        await make_org(db_session, user, org_name="Has Profile")

        res = await app_client.get(
            "/api/admin/orgs/pending", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 200
        assert [r["orgName"] for r in res.json()["data"]] == ["Has Profile"]


class TestOrgDetail:
    async def test_returns_profile_and_tallies(self, app_client: AsyncClient, db_session):
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, user, org_name="Detail Org")
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)
        await make_social_post(db_session, org)

        res = await app_client.get(
            f"/api/admin/orgs/{user.id}", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["orgName"] == "Detail Org"
        assert data["applications"]["accepted"] == 1
        assert data["applications"]["applied"] == 0
        assert data["postCount"] == 1
        assert data["impersonatable"] is True

    async def test_brand_user_not_found_as_org(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        res = await app_client.get(
            f"/api/admin/orgs/{brand.user_id}", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 404

    async def test_unknown_org(self, app_client: AsyncClient, db_session):
        res = await app_client.get(
            f"/api/admin/orgs/{uuid.uuid4()}", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 404


class TestBrandList:
    async def test_separates_brand_and_user_status(self, app_client: AsyncClient, db_session):
        """``deny_brand`` never touches ``users.status``, so the row must carry
        both to distinguish live / invite-pending / orphaned."""
        brand = await make_brand(db_session, brand_name="Split Brand")

        res = await app_client.get("/api/admin/brands", headers=await _admin_headers(db_session))
        assert res.status_code == 200
        row = res.json()["data"][0]
        assert row["status"] == BrandStatus.APPROVED.value
        assert row["userStatus"] == OrgUserStatus.ACTIVE.value
        assert row["passwordSet"] is False
        assert row["brandName"] == brand.brand_name

    async def test_status_filter(self, app_client: AsyncClient, db_session):
        pending = await make_brand(db_session, brand_name="Pending Brand")
        pending.status = BrandStatus.PENDING_REVIEW.value
        await make_brand(db_session, brand_name="Approved Brand")
        await db_session.flush()

        res = await app_client.get(
            "/api/admin/brands?status=pending_review", headers=await _admin_headers(db_session)
        )
        assert [r["brandName"] for r in res.json()["data"]] == ["Pending Brand"]

    async def test_unknown_status_rejected(self, app_client: AsyncClient, db_session):
        res = await app_client.get(
            "/api/admin/brands?status=nope", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 400


class TestBrandDetail:
    async def test_includes_invite_state_and_drops(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session, brand_name="Invited Brand")
        await make_drop(db_session, brand, title="Brand Drop")
        expires = _now() + timedelta(days=7)
        db_session.add(
            BrandInviteToken(
                id=uuid.uuid4(),
                user_id=brand.user_id,
                brand_id=brand.id,
                token=f"tok-{uuid.uuid4().hex}",
                email=brand.company_email,
                expires_at=expires,
            )
        )
        await db_session.flush()

        res = await app_client.get(
            f"/api/admin/brands/{brand.id}", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["invite"]["expiresAt"] is not None
        assert data["invite"]["usedAt"] is None
        assert [d["title"] for d in data["drops"]] == ["Brand Drop"]

    async def test_unknown_brand(self, app_client: AsyncClient, db_session):
        res = await app_client.get(
            f"/api/admin/brands/{uuid.uuid4()}", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 404


class TestDropList:
    async def test_counts_applicants_by_decision(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, title="Counted Drop")
        for name, decision in (
            ("A", ApplicationDecision.APPLIED),
            ("B", ApplicationDecision.ACCEPTED),
            ("C", ApplicationDecision.ACCEPTED),
        ):
            user = await persist(db_session, make_user(role=PortalRole.ORG))
            org = await make_org(db_session, user, org_name=name)
            await make_application(db_session, drop, org, decision=decision)

        res = await app_client.get("/api/admin/drops", headers=await _admin_headers(db_session))
        assert res.status_code == 200
        row = res.json()["data"][0]
        assert row["title"] == "Counted Drop"
        assert row["appliedCount"] == 1
        assert row["acceptedCount"] == 2

    async def test_stage_filter(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        await make_drop(db_session, brand, title="Early", stage=BrandTrackerStage.REQUEST_RECEIVED)
        await make_drop(db_session, brand, title="Late", stage=BrandTrackerStage.DROP_ACTIVE)

        res = await app_client.get(
            "/api/admin/drops?stage=drop_active", headers=await _admin_headers(db_session)
        )
        assert [r["title"] for r in res.json()["data"]] == ["Late"]

    async def test_attention_autoclose_overdue(self, app_client: AsyncClient, db_session):
        """Past its window, still request_received, not manually reopened — the
        canary for a dead ``drop_autoclose`` cron."""
        brand = await make_brand(db_session)
        await make_drop(
            db_session,
            brand,
            title="Overdue",
            apply_open_at=_now() - timedelta(days=10),
            apply_close_at=_now() - timedelta(days=1),
            stage=BrandTrackerStage.REQUEST_RECEIVED,
        )
        await make_drop(db_session, brand, title="Open")

        res = await app_client.get(
            "/api/admin/drops?attention=autoclose_overdue",
            headers=await _admin_headers(db_session),
        )
        assert [r["title"] for r in res.json()["data"]] == ["Overdue"]

    async def test_attention_no_tracking(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        await make_drop(db_session, brand, title="No TN", stage=BrandTrackerStage.AWAITING_PRODUCTS)
        tracked = await make_drop(
            db_session, brand, title="Tracked", stage=BrandTrackerStage.AWAITING_PRODUCTS
        )
        tracked.tracking_number = "TRACK-1"
        await db_session.flush()

        res = await app_client.get(
            "/api/admin/drops?attention=no_tracking", headers=await _admin_headers(db_session)
        )
        assert [r["title"] for r in res.json()["data"]] == ["No TN"]

    async def test_unknown_filters_rejected(self, app_client: AsyncClient, db_session):
        headers = await _admin_headers(db_session)
        assert (
            await app_client.get("/api/admin/drops?stage=bogus", headers=headers)
        ).status_code == 400
        assert (
            await app_client.get("/api/admin/drops?attention=bogus", headers=headers)
        ).status_code == 400


class TestDropDetail:
    async def test_returns_applicants_and_timeline(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, title="Detail Drop", total_product_units=10)
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, user, org_name="Applicant Org")
        application = await make_application(
            db_session, drop, org, decision=ApplicationDecision.ACCEPTED
        )
        application.allocated_units = 4
        await make_tracker_event(db_session, drop, note="kickoff")
        post = await make_social_post(db_session, org)
        await make_suggestion(db_session, post, application)
        await db_session.flush()

        res = await app_client.get(
            f"/api/admin/drops/{drop.id}", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["title"] == "Detail Drop"
        assert data["allocatedUnits"] == 4
        assert data["pendingSuggestionCount"] == 1
        assert len(data["applicants"]) == 1
        assert data["applicants"][0]["orgName"] == "Applicant Org"
        assert [e["note"] for e in data["trackerEvents"]] == ["kickoff"]

    async def test_unknown_drop(self, app_client: AsyncClient, db_session):
        res = await app_client.get(
            f"/api/admin/drops/{uuid.uuid4()}", headers=await _admin_headers(db_session)
        )
        assert res.status_code == 404


class TestOverview:
    async def test_queues_carry_count_and_oldest(self, app_client: AsyncClient, db_session):
        user = await persist(
            db_session,
            make_user(role=PortalRole.ORG, status=OrgUserStatus.PENDING_APPROVAL),
        )
        await make_org(db_session, user)
        brand = await make_brand(db_session, brand_name="Waiting")
        brand.status = BrandStatus.PENDING_REVIEW.value
        await db_session.flush()

        res = await app_client.get("/api/admin/overview", headers=await _admin_headers(db_session))
        assert res.status_code == 200
        data = res.json()["data"]
        orgs = _queue(data, "orgs_pending_approval")
        assert orgs["count"] == 1
        assert orgs["oldestAt"] is not None
        assert _queue(data, "brands_pending_review")["count"] == 1

    async def test_awaiting_finalization_queue(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        await make_drop(
            db_session,
            brand,
            stage=BrandTrackerStage.FINALIZING_AGREEMENTS,
            apply_open_at=_now() - timedelta(days=10),
            apply_close_at=_now() - timedelta(days=2),
        )

        res = await app_client.get("/api/admin/overview", headers=await _admin_headers(db_session))
        queue = _queue(res.json()["data"], "drops_awaiting_finalization")
        assert queue["count"] == 1
        assert queue["oldestAt"] is not None

    async def test_ready_to_advance_queue(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, stage=BrandTrackerStage.FINALIZING_AGREEMENTS)
        drop.applicant_selection_finalized_at = _now()
        await db_session.flush()

        res = await app_client.get("/api/admin/overview", headers=await _admin_headers(db_session))
        assert _queue(res.json()["data"], "drops_ready_to_advance")["count"] == 1

    async def test_warnings_omit_zero_counts(self, app_client: AsyncClient, db_session):
        res = await app_client.get("/api/admin/overview", headers=await _admin_headers(db_session))
        assert res.json()["data"]["warnings"] == []

    async def test_warns_on_unredeemed_brand_invite(self, app_client: AsyncClient, db_session):
        """Approved brand with no password can never set one — the invite is
        only issued from ``approve_brand``, which requires ``pending_review``."""
        await make_brand(db_session, brand_name="Locked Out")

        res = await app_client.get("/api/admin/overview", headers=await _admin_headers(db_session))
        warning = _warning(res.json()["data"], "brand_invite_never_redeemed")
        assert warning is not None and warning["count"] == 1

    async def test_warns_on_stranded_applicants(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        drop.applicant_selection_finalized_at = _now()
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, user)
        await make_application(db_session, drop, org, decision=ApplicationDecision.APPLIED)
        await db_session.flush()

        res = await app_client.get("/api/admin/overview", headers=await _admin_headers(db_session))
        warning = _warning(res.json()["data"], "stranded_applicants")
        assert warning is not None and warning["count"] == 1


class TestHealth:
    async def test_groups_present(self, app_client: AsyncClient, db_session):
        res = await app_client.get("/api/admin/health", headers=await _admin_headers(db_session))
        assert res.status_code == 200
        data = res.json()["data"]
        assert {"generatedAt", "pipeline", "instagramTokens", "integrity", "silent"} <= set(data)
        assert [s["key"] for s in data["pipeline"]] == [
            "drop_autoclose",
            "metric_sync",
            "token_cleanup",
            "token_refresh",
        ]

    async def test_autoclose_signal_flips(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        await make_drop(
            db_session,
            brand,
            apply_open_at=_now() - timedelta(days=10),
            apply_close_at=_now() - timedelta(days=1),
            stage=BrandTrackerStage.REQUEST_RECEIVED,
        )

        res = await app_client.get("/api/admin/health", headers=await _admin_headers(db_session))
        signal = _signal(res.json()["data"], "pipeline", "drop_autoclose")
        assert signal["count"] == 1
        assert signal["ok"] is False

    async def test_instagram_token_buckets(self, app_client: AsyncClient, db_session):
        from app.security.token_crypto import encrypt_token

        expired = await persist(db_session, make_user(role=PortalRole.ORG))
        expired.instagram_access_token = encrypt_token("tok")
        expired.instagram_token_expires_at = _now() - timedelta(days=1)
        healthy = await persist(db_session, make_user(role=PortalRole.ORG))
        healthy.instagram_access_token = encrypt_token("tok")
        healthy.instagram_token_expires_at = _now() + timedelta(days=60)
        await persist(db_session, make_user(role=PortalRole.ORG))  # no token at all
        await db_session.flush()

        res = await app_client.get("/api/admin/health", headers=await _admin_headers(db_session))
        tokens = res.json()["data"]["instagramTokens"]
        assert _signal({"instagramTokens": tokens}, "instagramTokens", "expired")["count"] == 1
        assert _signal({"instagramTokens": tokens}, "instagramTokens", "healthy")["count"] == 1
        assert _signal({"instagramTokens": tokens}, "instagramTokens", "missing")["count"] == 1
        assert (
            _signal({"instagramTokens": tokens}, "instagramTokens", "undecryptable")["count"] == 0
        )
        # Expiring-soon is the refresh job's normal workload, not a problem.
        assert (
            _signal({"instagramTokens": tokens}, "instagramTokens", "expiring_soon")["ok"] is True
        )

    async def test_notify_me_debt_counted(self, app_client: AsyncClient, db_session):
        """An enabled row on an opened drop that the reminder job never stamped
        is a reminder the subscriber never got."""
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, user)
        await make_notify(db_session, org, drop)

        res = await app_client.get("/api/admin/health", headers=await _admin_headers(db_session))
        signal = _signal(res.json()["data"], "silent", "notify_me_never_sent")
        assert signal["count"] == 1
        assert signal["ok"] is False

    async def test_notify_me_debt_clears_once_sent(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, user)
        notify = await make_notify(db_session, org, drop)
        notify.sent_at = datetime.now(timezone.utc)
        await db_session.flush()

        res = await app_client.get("/api/admin/health", headers=await _admin_headers(db_session))
        signal = _signal(res.json()["data"], "silent", "notify_me_never_sent")
        assert signal["count"] == 0
        assert signal["ok"] is True

    async def test_over_capacity_detected(self, app_client: AsyncClient, db_session):
        """Capacity is only checked per finalize call, so a second round can
        exceed it. This is the standing query that catches it."""
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, capacity_total=1)
        for name in ("One", "Two"):
            user = await persist(db_session, make_user(role=PortalRole.ORG))
            org = await make_org(db_session, user, org_name=name)
            await make_application(db_session, drop, org, decision=ApplicationDecision.ACCEPTED)

        res = await app_client.get("/api/admin/health", headers=await _admin_headers(db_session))
        assert _signal(res.json()["data"], "integrity", "accepted_over_capacity")["count"] == 1

    async def test_units_over_budget_detected(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand, capacity_total=5, total_product_units=3)
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, user)
        application = await make_application(
            db_session, drop, org, decision=ApplicationDecision.ACCEPTED
        )
        application.allocated_units = 9
        await db_session.flush()

        res = await app_client.get("/api/admin/health", headers=await _admin_headers(db_session))
        assert _signal(res.json()["data"], "integrity", "units_over_budget")["count"] == 1

    async def test_pending_suggestions_counted(self, app_client: AsyncClient, db_session):
        brand = await make_brand(db_session)
        drop = await make_drop(db_session, brand)
        user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, user)
        application = await make_application(
            db_session, drop, org, decision=ApplicationDecision.ACCEPTED
        )
        post = await make_social_post(db_session, org)
        await make_suggestion(db_session, post, application)

        res = await app_client.get("/api/admin/health", headers=await _admin_headers(db_session))
        assert _signal(res.json()["data"], "silent", "pending_suggestions")["count"] == 1

    async def test_failed_job_run_does_not_count_as_heartbeat(
        self, app_client: AsyncClient, db_session
    ):
        """A failed JobRun must not refresh last-run age — only ok=true runs do."""
        from app.models.job_run import JobRun

        failed = JobRun(
            id=uuid.uuid4(),
            job="drop_autoclose",
            started_at=_now() - timedelta(minutes=30),
            finished_at=_now() - timedelta(minutes=25),
            ok=False,
            summary={"error": "boom"},
        )
        db_session.add(failed)
        await db_session.flush()

        res = await app_client.get("/api/admin/health", headers=await _admin_headers(db_session))
        detail = _signal(res.json()["data"], "pipeline", "drop_autoclose")["detail"]
        assert "last run" not in detail

        ok_run = JobRun(
            id=uuid.uuid4(),
            job="drop_autoclose",
            started_at=_now() - timedelta(minutes=10),
            finished_at=_now() - timedelta(minutes=5),
            ok=True,
            summary={"closed": 0},
        )
        db_session.add(ok_run)
        await db_session.flush()

        res = await app_client.get("/api/admin/health", headers=await _admin_headers(db_session))
        detail = _signal(res.json()["data"], "pipeline", "drop_autoclose")["detail"]
        assert "last run" in detail

    async def test_story_posts_excluded_from_refresh_counters(
        self, app_client: AsyncClient, db_session
    ):
        """STORYs never refresh; they must not inflate sync-debt signals."""

        user = await persist(db_session, make_user(role=PortalRole.ORG))
        org = await make_org(db_session, user)
        feed = await make_social_post(db_session, org, caption="feed debt")
        feed.metrics_updated_at = None
        story = await make_social_post(
            db_session, org, caption="story", media_product_type=SocialMediaProductType.STORY
        )
        story.metrics_updated_at = None
        await db_session.flush()

        res = await app_client.get("/api/admin/health", headers=await _admin_headers(db_session))
        data = res.json()["data"]
        assert _signal(data, "silent", "posts_never_refreshed")["count"] == 1
        assert _signal(data, "pipeline", "metric_sync")["count"] == 1
