"""Live-server bug-bash harness — journey + fuzz.

Drives a RUNNING local API (`uvicorn app.main:app`) over HTTP the way a real
client would, and pokes the database directly only where the API can't reach
(email-verification tokens, time-gated drop windows, precise fixtures). Prints a
PASS/FAIL report and exits non-zero on any failure.

This is an exploratory bug-bash tool, NOT the pytest suite: it asserts
**invariants** (no 5xx, well-formed error envelopes, ownership 404s, status
codes) rather than exact values, so it stays low-maintenance across copy/amount
changes. Re-seed (`scripts/seed_dev.py`) for a clean slate; the harness creates
uniquely-suffixed fixtures so repeat runs don't collide.

Usage (server must be running with ENVIRONMENT=development):
    poetry run python scripts/bugbash.py                 # journey only
    poetry run python scripts/bugbash.py --fuzz 200       # journey + 200 fuzz iters
    poetry run python scripts/bugbash.py --base http://localhost:8000

Start the server with RATE_LIMIT_ENABLED=false so repeated/slow runs don't hit
the dev-login throttle (20/IP/60s); the one rate-limit scenario auto-skips when
limiting is off. Leave it on only when you specifically want to exercise the
throttle, and keep runs >60s apart.
"""

from __future__ import annotations

import argparse
import asyncio
import random
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from sqlalchemy import select

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.config import settings  # noqa: E402
from app.deps.db import async_session_factory, engine  # noqa: E402
from app.models.application import DropApplication  # noqa: E402
from app.models.brand import Brand  # noqa: E402
from app.models.drop import Drop  # noqa: E402
from app.models.enums import (  # noqa: E402
    ApplicationDecision,
    BrandStatus,
    BrandTrackerStage,
    OrgUserStatus,
    PortalRole,
)
from app.models.organization import Organization  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.verification_token import EmailVerificationToken  # noqa: E402
from app.security.one_shot_tokens import hash_token  # noqa: E402
from app.security.password import hash_password  # noqa: E402

BRAND_PW = "buzzbash123"


# --------------------------------------------------------------------------- #
# Reporter
# --------------------------------------------------------------------------- #
@dataclass
class Report:
    checks: list[tuple[bool, str, str]] = field(default_factory=list)

    def check(self, ok: bool, label: str, detail: str = "") -> bool:
        self.checks.append((ok, label, detail))
        mark = "✓" if ok else "✗"
        line = f"  {mark} {label}"
        if not ok and detail:
            line += f"  — {detail}"
        print(line)
        return ok

    @property
    def failures(self) -> list[tuple[bool, str, str]]:
        return [c for c in self.checks if not c[0]]

    def summary(self) -> int:
        total, failed = len(self.checks), len(self.failures)
        print("\n" + "=" * 60)
        print(f"  {total - failed}/{total} checks passed")
        if failed:
            print(f"  {failed} FAILED:")
            for _, label, detail in self.failures:
                print(f"    ✗ {label}  {detail}")
        print("=" * 60)
        return 1 if failed else 0


# --------------------------------------------------------------------------- #
# HTTP harness
# --------------------------------------------------------------------------- #
class Api:
    def __init__(self, base: str, report: Report):
        self.base = base.rstrip("/")
        self.report = report
        self.client = httpx.AsyncClient(base_url=self.base, timeout=15.0)

    async def close(self) -> None:
        await self.client.aclose()

    async def req(
        self,
        method: str,
        path: str,
        *,
        token: str | None = None,
        json: Any = None,
        cookies: dict | None = None,
    ) -> httpx.Response:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        resp = await self.client.request(method, path, headers=headers, json=json, cookies=cookies)
        # Hard invariant: the server must never 5xx.
        if resp.status_code >= 500:
            self.report.check(False, f"NO 5xx on {method} {path}", f"got {resp.status_code}")
        return resp

    async def dev_login(self, *, user_id: str | None = None, ig: str | None = None) -> str | None:
        body: dict = {}
        if user_id:
            body["user_id"] = user_id
        if ig:
            body["instagram_user_id"] = ig
        resp = await self.req("POST", "/api/auth/dev-login", json=body)
        if resp.status_code == 429:
            self.report.check(
                False, "dev-login rate-limited", "run with RATE_LIMIT_ENABLED=false or wait 60s"
            )
            return None
        if resp.status_code != 200:
            return None
        return resp.json()["data"]["access_token"]

    async def brand_login(self, email: str, password: str) -> str | None:
        resp = await self.req(
            "POST", "/api/auth/brand/login", json={"email": email, "password": password}
        )
        if resp.status_code == 429:
            self.report.check(
                False, "brand-login rate-limited", "run with RATE_LIMIT_ENABLED=false or wait 60s"
            )
            return None
        if resp.status_code != 200:
            return None
        return resp.json()["data"]["access_token"]


def _ok(resp: httpx.Response, *codes: int) -> bool:
    return resp.status_code in codes


def _err_code(resp: httpx.Response) -> str | None:
    try:
        return resp.json()["error"]["code"]
    except Exception:  # noqa: BLE001
        return None


# --------------------------------------------------------------------------- #
# DB helpers (localhost-guarded, like seed_dev)
# --------------------------------------------------------------------------- #
def _guard_local() -> None:
    """Refuse to run against a non-local DB (the harness writes fixtures)."""
    # Strip the SQLAlchemy driver suffix so urlparse sees a plain scheme.
    url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    host = (urlparse(url).hostname or "").lower()
    # Empty host = UNIX socket (local). Otherwise it must be loopback.
    if host and host not in {"localhost", "127.0.0.1", "::1"}:
        raise SystemExit(f"Refusing to run the bug-bash against non-local DB host: {host!r}")


def _uid() -> str:
    return uuid.uuid4().hex[:10]


async def db_make_active_org(suffix: str) -> tuple[uuid.UUID, uuid.UUID]:
    """Create an active org user + profile; return (user_id, org_id)."""
    async with async_session_factory() as db:
        user = User(
            id=uuid.uuid4(),
            portal_role=PortalRole.ORG.value,
            status=OrgUserStatus.ACTIVE.value,
            instagram_user_id=f"ig_bash_{suffix}",
            instagram_username=f"bashorg{suffix}",
            edu_email=f"bash-{suffix}@campus.edu",
        )
        db.add(user)
        await db.flush()
        org = Organization(
            id=uuid.uuid4(),
            user_id=user.id,
            org_name=f"Bash Org {suffix}",
            university="Bash University",
            follower_count=1000,
        )
        db.add(org)
        await db.commit()
        return user.id, org.id


async def db_make_finalize_ready_drop() -> dict[str, Any]:
    """Create an approved brand + a drop in finalizing_agreements (window closed)
    with 3 applied orgs. Returns ids needed to drive the finalize flow."""
    suffix = _uid()
    async with async_session_factory() as db:
        brand_user = User(
            id=uuid.uuid4(),
            portal_role=PortalRole.BRAND.value,
            status=OrgUserStatus.ACTIVE.value,
            password_hash=hash_password(BRAND_PW),
        )
        db.add(brand_user)
        await db.flush()
        email = f"bashbrand-{suffix}@brand.test"
        brand = Brand(
            id=uuid.uuid4(),
            user_id=brand_user.id,
            brand_name=f"Bash Brand {suffix}",
            company_email=email,
            status=BrandStatus.APPROVED.value,
        )
        db.add(brand)
        await db.flush()
        now = datetime.now(timezone.utc)
        drop = Drop(
            id=uuid.uuid4(),
            brand_id=brand.id,
            title=f"Bash Drop {suffix}",
            description="finalize-ready",
            image="https://example.test/i.png",
            location="Bash City",
            capacity_total=5,
            apply_open_at=now - timedelta(days=3),
            apply_close_at=now - timedelta(days=1),  # window CLOSED
            manual_reopen=False,
            brand_tracker_stage=BrandTrackerStage.FINALIZING_AGREEMENTS.value,
            total_product_units=100,
        )
        db.add(drop)
        await db.flush()
        org_ids = []
        for i in range(3):
            ou = User(
                id=uuid.uuid4(),
                portal_role=PortalRole.ORG.value,
                status=OrgUserStatus.ACTIVE.value,
                instagram_user_id=f"ig_bashapp_{suffix}_{i}",
                edu_email=f"bashapp-{suffix}-{i}@campus.edu",
            )
            db.add(ou)
            await db.flush()
            org = Organization(
                id=uuid.uuid4(),
                user_id=ou.id,
                org_name=f"Applicant {i} {suffix}",
                university="Bash U",
                follower_count=500 * (i + 1),
            )
            db.add(org)
            await db.flush()
            db.add(
                DropApplication(
                    id=uuid.uuid4(),
                    drop_id=drop.id,
                    org_id=org.id,
                    decision=ApplicationDecision.APPLIED.value,
                )
            )
            org_ids.append(str(org.id))
        await db.commit()
        return {
            "brand_email": email,
            "drop_id": str(drop.id),
            "org_ids": org_ids,
        }


async def db_latest_verification_token(user_id: uuid.UUID) -> str | None:
    """Return a redeemable raw token by re-hashing the latest unused row.

    Tokens are stored hashed; this bash helper plants a known raw secret so
    verify-email can be exercised without reading the outbound email.
    """
    import secrets

    raw = secrets.token_urlsafe(48)
    async with async_session_factory() as db:
        evt = await db.scalar(
            select(EmailVerificationToken)
            .where(
                EmailVerificationToken.user_id == user_id,
                EmailVerificationToken.used_at.is_(None),
            )
            .order_by(EmailVerificationToken.created_at.desc())
        )
        if evt is None:
            return None
        evt.token_hash = hash_token(raw)
        await db.commit()
        return raw


async def db_make_onboarding_org() -> uuid.UUID:
    suffix = _uid()
    async with async_session_factory() as db:
        user = User(
            id=uuid.uuid4(),
            portal_role=PortalRole.ORG.value,
            status=OrgUserStatus.PENDING_ORG_PROFILE.value,
            instagram_user_id=f"ig_bashob_{suffix}",
            instagram_username=f"bashob{suffix}",
        )
        db.add(user)
        await db.commit()
        return user.id


async def db_admin_id() -> uuid.UUID | None:
    async with async_session_factory() as db:
        return await db.scalar(select(User.id).where(User.portal_role == PortalRole.ADMIN.value))


async def db_org_id_for_user(user_id: uuid.UUID) -> uuid.UUID | None:
    async with async_session_factory() as db:
        return await db.scalar(select(Organization.id).where(Organization.user_id == user_id))


async def db_mark_finalized(drop_id: str) -> None:
    """Mark a drop's applicant selection finalized (so the tracker can advance)."""
    async with async_session_factory() as db:
        drop = await db.get(Drop, uuid.UUID(drop_id))
        if drop is not None:
            drop.applicant_selection_finalized_at = datetime.now(timezone.utc)
            await db.commit()


# --------------------------------------------------------------------------- #
# Journey scenarios
# --------------------------------------------------------------------------- #
async def scenario_health(api: Api) -> None:
    print("\n[health]")
    r = await api.req("GET", "/api/health")
    api.report.check(_ok(r, 200), "GET /api/health 200", str(r.status_code))
    r = await api.req("GET", "/api/config")
    api.report.check(_ok(r, 200), "GET /api/config 200", str(r.status_code))


async def scenario_authz(api: Api) -> None:
    print("\n[authz matrix]")
    r = await api.req("GET", "/api/brands/me")
    api.report.check(_ok(r, 401), "unauth brand/me -> 401", str(r.status_code))
    r = await api.req("GET", "/api/orgs/me", token="garbage.token.here")
    api.report.check(_ok(r, 401), "bad token orgs/me -> 401", str(r.status_code))
    # org token hitting a brand-only route
    org_tok = await api.dev_login()
    if api.report.check(bool(org_tok), "dev-login (default active org)"):
        r = await api.req("GET", "/api/brands/me", token=org_tok)
        api.report.check(_ok(r, 403), "org -> brand/me 403", str(r.status_code))
        r = await api.req("GET", "/api/admin/orgs/pending", token=org_tok)
        api.report.check(_ok(r, 403), "org -> admin 403", str(r.status_code))


async def scenario_org_happy(api: Api) -> None:
    print("\n[org happy path]")
    # fresh active org with no applications so apply is clean
    user_id, _org_id = await db_make_active_org(_uid())
    tok = await api.dev_login(user_id=str(user_id))
    if not api.report.check(bool(tok), "dev-login fresh org"):
        return
    r = await api.req("GET", "/api/auth/me", token=tok)
    api.report.check(_ok(r, 200), "GET /api/auth/me 200", str(r.status_code))
    r = await api.req("GET", "/api/drops", token=tok)
    feed_ok = _ok(r, 200)
    api.report.check(feed_ok, "GET /api/drops 200", str(r.status_code))
    drops = r.json()["data"] if feed_ok else []
    # notify-state fields present (Stage 10)
    if drops:
        d0 = drops[0]
        api.report.check(
            "notifyRequested" in d0 and "reminderMinutes" in d0,
            "feed item carries notify state",
            str(list(d0.keys())),
        )
    r = await api.req("GET", "/api/orgs/me", token=tok)
    api.report.check(_ok(r, 200), "GET /api/orgs/me 200", str(r.status_code))
    r = await api.req("GET", "/api/orgs/me/posts", token=tok)
    api.report.check(_ok(r, 200), "GET /api/orgs/me/posts 200", str(r.status_code))
    r = await api.req("GET", "/api/campaigns", token=tok)
    api.report.check(_ok(r, 200), "GET /api/campaigns 200", str(r.status_code))

    # find an OPEN drop (window open) to apply to
    open_drop = None
    now_ms = datetime.now(timezone.utc).timestamp() * 1000
    for d in drops:
        if (
            d["applyOpenAt"] <= now_ms <= d["applyCloseAt"]
            and d["acceptedCount"] < d["capacityTotal"]
        ):
            open_drop = d
            break
    if open_drop:
        did = open_drop["id"]
        r = await api.req("POST", f"/api/drops/{did}/apply", token=tok, json={"pitch": "bash"})
        applied = _ok(r, 200)
        api.report.check(applied, "apply to open drop 200", str(r.status_code))
        if applied:
            r2 = await api.req(
                "POST", f"/api/drops/{did}/apply", token=tok, json={"pitch": "again"}
            )
            api.report.check(
                _err_code(r2) == "ALREADY_APPLIED",
                "double-apply -> ALREADY_APPLIED",
                f"{r2.status_code} {_err_code(r2)}",
            )
    else:
        api.report.check(True, "(no open drop to apply to — skipped)", "")

    # notify on an UPCOMING drop
    upcoming = next((d for d in drops if d["applyOpenAt"] > now_ms), None)
    if upcoming:
        did = upcoming["id"]
        r = await api.req(
            "POST", f"/api/drops/{did}/notify", token=tok, json={"reminderMinutes": 15}
        )
        api.report.check(_ok(r, 200), "notify set 200", str(r.status_code))
        r = await api.req("DELETE", f"/api/drops/{did}/notify", token=tok)
        api.report.check(_ok(r, 200), "notify clear 200", str(r.status_code))


async def scenario_onboarding(api: Api) -> None:
    print("\n[org onboarding + admin approve]")
    uid = await db_make_onboarding_org()
    tok = await api.dev_login(user_id=str(uid))
    if not api.report.check(bool(tok), "dev-login onboarding org"):
        return
    suffix = _uid()
    r = await api.req(
        "POST",
        "/api/orgs/onboarding",
        token=tok,
        json={
            "orgName": "Bash Onboard",
            "university": "Bash U",
            "eduEmail": f"onboard-{suffix}@campus.edu",
            "category": "academic",
            "memberCount": 25,
            "city": "Ithaca",
            "state": "NY",
            "contactName": "Bash Contact",
            "deliveryAddress": "1 Bash Way",
        },
    )
    submitted = _ok(r, 200)
    api.report.check(submitted, "onboarding submit 200", str(r.status_code))
    if not submitted:
        return
    token = await db_latest_verification_token(uid)
    if not api.report.check(bool(token), "verification token issued (DB)"):
        return
    r = await api.req("POST", "/api/auth/verify-email", token=tok, json={"token": token})
    verified = _ok(r, 200)
    api.report.check(verified, "verify-email 200 -> pending_approval", str(r.status_code))
    # re-verify is idempotent-ish: already verified
    r = await api.req("POST", "/api/auth/verify-email", token=tok, json={"token": token})
    api.report.check(
        _err_code(r) in ("EMAIL_ALREADY_VERIFIED", "VERIFICATION_TOKEN_USED"),
        "re-verify -> already-verified error",
        f"{r.status_code} {_err_code(r)}",
    )
    # admin approves
    admin_id = await db_admin_id()
    admin_tok = await api.dev_login(user_id=str(admin_id)) if admin_id else None
    if api.report.check(bool(admin_tok), "dev-login admin"):
        r = await api.req("GET", "/api/admin/orgs/pending", token=admin_tok)
        api.report.check(_ok(r, 200), "admin pending orgs 200", str(r.status_code))
        # approve takes the Organization id (not the user id)
        org_id = await db_org_id_for_user(uid)
        r = await api.req("POST", f"/api/admin/orgs/{org_id}/approve", token=admin_tok)
        api.report.check(_ok(r, 200), "admin approve org 200", str(r.status_code))


async def scenario_brand_finalize(api: Api) -> None:
    print("\n[brand finalize + denial]")
    fx = await db_make_finalize_ready_drop()
    tok = await api.brand_login(fx["brand_email"], BRAND_PW)
    if not api.report.check(bool(tok), "brand login"):
        return
    r = await api.req("GET", "/api/brands/me", token=tok)
    api.report.check(_ok(r, 200), "GET /api/brands/me 200", str(r.status_code))
    did = fx["drop_id"]
    r = await api.req("GET", f"/api/brands/me/drops/{did}", token=tok)
    detail_ok = _ok(r, 200)
    api.report.check(detail_ok, "brand drop detail 200", str(r.status_code))
    if detail_ok:
        apps = r.json()["data"]["applications"]
        api.report.check(len(apps) == 3, "detail shows 3 applicants", str(len(apps)))
    # accept 2, deny 1 (the 3rd org not listed)
    accept = fx["org_ids"][:2]
    r = await api.req(
        "POST",
        f"/api/brands/me/drops/{did}/finalize-applicants",
        token=tok,
        json={"allocations": [{"orgId": o, "units": 10} for o in accept]},
    )
    fin_ok = _ok(r, 200)
    api.report.check(fin_ok, "finalize 200", f"{r.status_code} {r.text[:120]}")
    if fin_ok:
        data = r.json()["data"]
        api.report.check(
            data.get("acceptedCount") == 2 and data.get("deniedCount") == 1,
            "finalize accepted=2 denied=1 (denial email triggered)",
            str(data),
        )
        # re-finalize blocked
        r2 = await api.req(
            "POST",
            f"/api/brands/me/drops/{did}/finalize-applicants",
            token=tok,
            json={"allocations": []},
        )
        api.report.check(
            _err_code(r2) == "ALREADY_FINALIZED",
            "re-finalize -> ALREADY_FINALIZED",
            f"{r2.status_code} {_err_code(r2)}",
        )
    r = await api.req("GET", "/api/brands/me/aggregate", token=tok)
    api.report.check(_ok(r, 200), "brand aggregate 200", str(r.status_code))
    r = await api.req("GET", "/api/brands/me/engagement-series", token=tok)
    api.report.check(_ok(r, 200), "engagement series 200", str(r.status_code))


async def scenario_admin_tracker(api: Api) -> None:
    print("\n[admin tracker + reopen]")
    fx = await db_make_finalize_ready_drop()  # a fresh drop in finalizing_agreements
    admin_id = await db_admin_id()
    admin_tok = await api.dev_login(user_id=str(admin_id)) if admin_id else None
    if not api.report.check(bool(admin_tok), "dev-login admin"):
        return
    did = fx["drop_id"]
    # L10: advancing past finalizing_agreements while unfinalized is rejected.
    r = await api.req(
        "PATCH",
        f"/api/admin/drops/{did}/tracker",
        token=admin_tok,
        json={"stage": "awaiting_products", "trackingNumber": "BASH-TRK-1"},
    )
    api.report.check(
        _err_code(r) == "DROP_NOT_IN_SELECTION_STAGE",
        "tracker skip past selection blocked (unfinalized)",
        f"{r.status_code} {_err_code(r)}",
    )
    # Finalize, then the advance is allowed.
    await db_mark_finalized(did)
    r = await api.req(
        "PATCH",
        f"/api/admin/drops/{did}/tracker",
        token=admin_tok,
        json={"stage": "awaiting_products", "trackingNumber": "BASH-TRK-1"},
    )
    api.report.check(
        _ok(r, 200), "tracker -> awaiting_products 200 (finalized)", str(r.status_code)
    )
    # backward move rejected
    r = await api.req(
        "PATCH",
        f"/api/admin/drops/{did}/tracker",
        token=admin_tok,
        json={"stage": "request_received"},
    )
    api.report.check(_ok(r, 400), "tracker backward -> 400", str(r.status_code))
    # reopen
    r = await api.req("POST", f"/api/admin/drops/{did}/reopen", token=admin_tok)
    api.report.check(_ok(r, 200), "reopen 200", str(r.status_code))


async def scenario_rate_limit(api: Api) -> None:
    print("\n[rate limit]")
    if not settings.RATE_LIMIT_ENABLED:
        api.report.check(True, "(rate limiting disabled — skipped)", "")
        return
    codes = []
    for i in range(7):
        r = await api.req(
            "POST",
            "/api/brands/apply",
            json={
                "brandName": f"RL Brand {i}",
                "companyEmail": f"rl-bash-{i}@example.com",
            },
        )
        codes.append(r.status_code)
    api.report.check(429 in codes, "brand_apply rate-limited (429 within 7 calls)", str(codes))


async def run_journey(api: Api) -> None:
    await scenario_health(api)
    await scenario_authz(api)
    await scenario_org_happy(api)
    await scenario_onboarding(api)
    await scenario_brand_finalize(api)
    await scenario_admin_tracker(api)
    await scenario_rate_limit(api)


# --------------------------------------------------------------------------- #
# Fuzz
# --------------------------------------------------------------------------- #
def _rand_body(kind: str) -> Any:
    if kind == "apply":
        return random.choice([{}, {"pitch": "x" * random.randint(0, 5000)}, {"pitch": None}])
    if kind == "notify":
        return {"reminderMinutes": random.choice([5, 15, 60, 0, -1, 999, "x"])}
    if kind == "finalize":
        return {"allocations": [{"orgId": str(uuid.uuid4()), "units": random.randint(-5, 999)}]}
    if kind == "onboarding":
        return {
            "orgName": random.choice(["", "x" * 300, "Ok"]),
            "university": "U",
            "eduEmail": random.choice(["a@b.edu", "nope", "a@b.com", "x" * 400]),
            "instagramHandle": "h",
            "category": random.choice(["sports", "bogus", None]),
        }
    if kind == "tracker":
        return {"stage": random.choice(["awaiting_products", "bogus", "", "drop_active"])}
    if kind == "brand_apply":
        return {
            "brandName": random.choice(["", "x" * 500]),
            "companyEmail": random.choice(["a@b.com", "nope"]),
        }
    return {}


async def run_fuzz(api: Api, n: int, tokens: dict[str, str | None]) -> None:
    print(f"\n[fuzz x{n}]  (invariant: no 5xx, error envelope well-formed on 4xx)")
    rid = lambda: random.choice([str(uuid.uuid4()), "not-a-uuid", "123"])  # noqa: E731
    # (method, path-template, body-kind, which-token)
    targets = [
        ("GET", "/api/drops/{id}", None, "org"),
        ("POST", "/api/drops/{id}/apply", "apply", "org"),
        ("POST", "/api/drops/{id}/notify", "notify", "org"),
        ("DELETE", "/api/drops/{id}/notify", None, "org"),
        ("GET", "/api/campaigns/{id}", None, "org"),
        ("GET", "/api/campaigns/{id}/aggregate", None, "org"),
        ("POST", "/api/campaigns/{id}/link-post", "apply", "org"),
        ("GET", "/api/orgs/me", None, "org"),
        ("POST", "/api/orgs/onboarding", "onboarding", "org"),
        ("GET", "/api/brands/me/drops/{id}", None, "brand"),
        ("POST", "/api/brands/me/drops/{id}/finalize-applicants", "finalize", "brand"),
        ("PATCH", "/api/admin/drops/{id}/tracker", "tracker", "admin"),
        ("POST", "/api/admin/orgs/{id}/approve", None, "admin"),
        ("POST", "/api/admin/orgs/{id}/deny", None, "admin"),
        ("POST", "/api/brands/apply", "brand_apply", None),
        ("GET", "/api/brands/me", None, "org"),  # cross-role
    ]
    bad_envelope = 0
    fived = 0
    for _ in range(n):
        method, tmpl, kind, who = random.choice(targets)
        path = tmpl.replace("{id}", rid())
        body = _rand_body(kind) if kind else None
        tok = tokens.get(who) if who else None
        resp = await api.req(method, path, token=tok, json=body)
        if resp.status_code >= 500:
            fived += 1
        elif resp.status_code >= 400:
            # 422 (validation) bodies also carry error.code in this API
            if _err_code(resp) is None:
                bad_envelope += 1
    api.report.check(fived == 0, f"fuzz: zero 5xx across {n} calls", f"{fived} 5xx")
    api.report.check(
        bad_envelope == 0,
        "fuzz: every 4xx has a well-formed error envelope",
        f"{bad_envelope} malformed",
    )


# --------------------------------------------------------------------------- #
async def main() -> int:
    parser = argparse.ArgumentParser(description="Buzz live-server bug-bash harness")
    parser.add_argument("--base", default="http://localhost:8000")
    parser.add_argument(
        "--fuzz", type=int, default=0, help="run N fuzz iterations after the journey"
    )
    args = parser.parse_args()

    if settings.ENVIRONMENT != "development":
        raise SystemExit("Run with ENVIRONMENT=development (dev-login is dev-only).")
    _guard_local()

    report = Report()
    api = Api(args.base, report)
    try:
        # quick reachability check
        try:
            await api.req("GET", "/api/health")
        except httpx.ConnectError:
            raise SystemExit(f"Cannot reach {args.base} — is `uvicorn app.main:app` running?")

        await run_journey(api)

        if args.fuzz:
            tokens = {
                "org": await api.dev_login(),
                "brand": await api.brand_login("partnerships@acme.coffee", "buzzdev123"),
                "admin": await api.dev_login(user_id=str(await db_admin_id())),
            }
            await run_fuzz(api, args.fuzz, tokens)
    finally:
        await api.close()
        await engine.dispose()

    return report.summary()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
