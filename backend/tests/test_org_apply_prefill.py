"""Org apply prefill parse + GET/apply/cleanup."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy import select

from app import errors
from app.jobs.token_cleanup import cleanup_tokens
from app.models.org_apply_prefill import OrgApplyPrefill
from app.models.user import User
from app.security.one_shot_tokens import hash_token
from app.services.org_apply_prefill import (
    deliver_saved_prefill_email,
    insert_prefill,
    raw_token_from_apply_url,
)
from app.services.org_apply_prefill_parse import ParsedPrefill, parse_form_row, parse_shipping
from tests.test_org_apply import _APPLY


def _now() -> datetime:
    return datetime.now(timezone.utc)


def test_parse_ent_cornell() -> None:
    p = parse_form_row(
        [
            "8/18/2026 1:19:20",
            "mc3237@cornell.edu",
            "Melissa Chowdhury",
            "9176225842",
            "Marketing Chair",
            "Cornell University, Epsilon Nu Tau",
            "121 Lake St, Ithaca, NY 14850",
            "60",
            "Yes",
            "",
            "https://www.instagram.com/entcornell/",
            "1k",
        ]
    )
    assert p.invite_email == "mc3237@cornell.edu"
    assert p.edu_email == "mc3237@cornell.edu"
    assert p.org_name == "Epsilon Nu Tau"
    assert p.university == "Cornell University"
    assert p.member_count == 60
    assert p.instagram_handle == "entcornell"
    assert p.shipping_line1 == "121 Lake St"
    assert p.shipping_city == "Ithaca"
    assert p.shipping_state == "NY"
    assert p.shipping_postal_code == "14850"
    assert p.extras["phone"] == "9176225842"
    assert "1k" not in str(p.extras)
    assert "edu_email_not_edu" not in p.warnings


def test_parse_cwru_ohio() -> None:
    p = parse_form_row(
        [
            "t",
            "sxk2197@case.edu",
            "Stephanie Kim",
            "8157646462",
            "VP of Marketing",
            "Case Western Reserve University, Alpha Gamma Delta",
            "11909 Carlton Road, Cleveland, Ohio 44106",
            "100",
            "Yes",
            "",
            "https://www.instagram.com/alphagamcwru/",
            "2.2k",
        ]
    )
    assert p.org_name == "Alpha Gamma Delta"
    assert p.shipping_state == "OH"
    assert p.shipping_city == "Cleveland"
    assert p.shipping_line1 == "11909 Carlton Road"
    assert p.instagram_handle == "alphagamcwru"


def test_parse_alabama_unsplit_and_not_edu() -> None:
    p = parse_form_row(
        [
            "t",
            "prvp@uagammaphi.com",
            "Tiana Carenza",
            "9145843887",
            "Public Relations Vice President",
            "University of Alabama Gamma Phi Beta",
            "780 Paul W Bryant Dr, Tuscaloosa AL, 35487",
            "450",
            "Yes",
            "",
            "http://www.instagram.com/uagammaphi",
            "34.3k",
        ]
    )
    assert p.org_name is None
    assert p.university is None
    assert "unsplit_org_university" in p.warnings
    assert p.edu_email is None
    assert "edu_email_not_edu" in p.warnings
    assert p.instagram_handle == "uagammaphi"
    assert p.shipping_city == "Tuscaloosa"
    assert p.shipping_state == "AL"
    assert p.shipping_postal_code == "35487"
    assert p.shipping_line1 == "780 Paul W Bryant Dr"

    fixed = parse_form_row(
        [
            "t",
            "prvp@uagammaphi.com",
            "Tiana",
            "1",
            "role",
            "University of Alabama, Gamma Phi Beta",
            "780 Paul W Bryant Dr, Tuscaloosa AL, 35487",
            "450",
            "Yes",
            "",
            "http://www.instagram.com/uagammaphi",
            "34.3k",
        ]
    )
    assert fixed.org_name == "Gamma Phi Beta"
    assert fixed.university == "University of Alabama"


def test_parse_miami_gmail_box() -> None:
    p = parse_form_row(
        [
            "t",
            "miamiztapr@gmail.com",
            "Olivia Iljaz",
            "3479610361",
            "PR Chair",
            "University of Miami, Zeta Tau Alpha",
            "1211 Walsh Ave, Coral Gables, FL, 33146\nBox #193886",
            "300",
            "Yes",
            "",
            "https://www.instagram.com/UmiamiZTA/",
            "14k",
        ]
    )
    assert p.edu_email is None
    assert p.instagram_handle == "umiamizta"
    assert p.shipping_line1 == "1211 Walsh Ave"
    assert p.shipping_line2 == "Box #193886"
    assert p.shipping_city == "Coral Gables"
    assert p.shipping_state == "FL"
    assert p.shipping_postal_code == "33146"


def test_parse_theta_comma_light() -> None:
    p = parse_form_row(
        [
            "t",
            "mp2282@cornell.edu",
            "Mia Philippi",
            "9713297650",
            "President",
            "Cornell University, Kappa Alpha Theta",
            "519 Stewart Ave. Ithaca NY 14850",
            "140",
            "Yes",
            "",
            "https://www.instagram.com/thetacornell",
            "3.2k",
        ]
    )
    assert p.org_name == "Kappa Alpha Theta"
    assert p.instagram_handle == "thetacornell"
    assert p.shipping_line1 == "519 Stewart Ave."
    assert p.shipping_city == "Ithaca"
    assert p.shipping_state == "NY"
    assert p.shipping_postal_code == "14850"


def test_parse_shipping_empty() -> None:
    assert parse_shipping(None)["shipping_raw"] is None


def test_read_sheet_rows_skips_header_and_quoted_multiline(tmp_path) -> None:
    import importlib.util
    from pathlib import Path

    script = Path(__file__).resolve().parents[1] / "scripts" / "import_org_apply_prefills.py"
    spec = importlib.util.spec_from_file_location("import_org_apply_prefills", script)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    sheet = tmp_path / "prefills.csv"
    sheet.write_text(
        "Timestamp,Email,Contact Name,Phone,Role,Sorority Name,Shipping Address,"
        "Number of members,Collaboration,Additional Notes,Instagram Profile URL\n"
        "9/1/2026 12:00:00,greeks@cornell.edu,Alex,555,President,"
        '"Cornell University, Campus Greeks",'
        '"123 College Ave, Ithaca, NY 14850\nBox #99",40,Yes,,'
        "https://www.instagram.com/campusgreeks/\n",
        encoding="utf-8",
    )
    rows = mod.read_sheet_rows(sheet)
    assert len(rows) == 1
    p = parse_form_row(rows[0])
    assert p.org_name == "Campus Greeks"
    assert p.university == "Cornell University"
    assert p.member_count == 40
    assert p.shipping_line1 == "123 College Ave"
    assert p.shipping_line2 == "Box #99"
    assert p.shipping_city == "Ithaca"


def test_write_prefill_sidecar_shape(tmp_path) -> None:
    import importlib.util
    from pathlib import Path

    script = Path(__file__).resolve().parents[1] / "scripts" / "import_org_apply_prefills.py"
    spec = importlib.util.spec_from_file_location("import_org_apply_prefills", script)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    out = tmp_path / "links.json"
    mod.write_prefill_sidecar(
        out,
        [
            {
                "invite_email": "greeks@cornell.edu",
                "org_name": "Campus Greeks",
                "apply_url": "https://www.example.com/org/apply?prefill=secret-token",
            }
        ],
    )
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["rows"][0]["apply_url"].endswith("prefill=secret-token")
    assert data["rows"][0]["invite_email"] == "greeks@cornell.edu"


def test_raw_token_from_apply_url() -> None:
    assert (
        raw_token_from_apply_url("https://www.bringthebuzzover.com/org/apply?prefill=abc.def")
        == "abc.def"
    )
    assert raw_token_from_apply_url("not-a-url") is None


async def test_deliver_saved_prefill_email_skips_and_sends(db_session, monkeypatch) -> None:
    parsed = ParsedPrefill(
        invite_email="greeks@cornell.edu",
        edu_email="greeks@cornell.edu",
        contact_name="Alex",
        org_name="Campus Greeks",
        university="Cornell University",
        member_count=40,
        category="sorority",
        instagram_handle="campusgreeks",
        shipping_raw="123 College Ave, Ithaca, NY 14850",
        shipping_line1="123 College Ave",
        shipping_line2=None,
        shipping_city="Ithaca",
        shipping_state="NY",
        shipping_postal_code="14850",
        extras={},
        source_row_key="k-send|greeks@cornell.edu",
        warnings=[],
    )
    row, raw = await insert_prefill(db_session, parsed)
    await db_session.flush()
    url = f"https://www.example.com/org/apply?prefill={raw}"

    sent: list[tuple[str, str, str]] = []

    async def _fake_send(to_email: str, token: str, *, org_name: str = "") -> bool:
        sent.append((to_email, token, org_name))
        return True

    monkeypatch.setattr(
        "app.services.org_apply_prefill.send_org_apply_prefill_email",
        _fake_send,
    )

    assert (
        await deliver_saved_prefill_email(
            db_session,
            invite_email="greeks@cornell.edu",
            org_name="Campus Greeks",
            apply_url=url,
        )
        == "sent"
    )
    await db_session.flush()
    assert row.email_sent_at is not None
    assert sent == [("greeks@cornell.edu", raw, "Campus Greeks")]

    assert (
        await deliver_saved_prefill_email(
            db_session,
            invite_email="greeks@cornell.edu",
            org_name="Campus Greeks",
            apply_url=url,
        )
        == "skipped_already_sent"
    )
    assert len(sent) == 1

    assert (
        await deliver_saved_prefill_email(
            db_session,
            invite_email="greeks@cornell.edu",
            org_name="Campus Greeks",
            apply_url="https://www.example.com/org/apply?prefill=nope",
        )
        == "skipped_not_live"
    )

    used, used_raw = await insert_prefill(
        db_session,
        ParsedPrefill(
            invite_email="used@cornell.edu",
            edu_email="used@cornell.edu",
            contact_name="U",
            org_name="Used Org",
            university="Cornell University",
            member_count=1,
            category="sorority",
            instagram_handle="usedorg",
            shipping_raw=None,
            shipping_line1=None,
            shipping_line2=None,
            shipping_city=None,
            shipping_state=None,
            shipping_postal_code=None,
            extras={},
            source_row_key="k-used|used@cornell.edu",
            warnings=[],
        ),
    )
    used.used_at = _now()
    await db_session.flush()
    assert (
        await deliver_saved_prefill_email(
            db_session,
            invite_email="used@cornell.edu",
            org_name="Used Org",
            apply_url=f"https://www.example.com/org/apply?prefill={used_raw}",
        )
        == "skipped_not_live"
    )

    expired, exp_raw = await insert_prefill(
        db_session,
        ParsedPrefill(
            invite_email="exp@cornell.edu",
            edu_email="exp@cornell.edu",
            contact_name="E",
            org_name="Expired Org",
            university="Cornell University",
            member_count=1,
            category="sorority",
            instagram_handle="expiredorg",
            shipping_raw=None,
            shipping_line1=None,
            shipping_line2=None,
            shipping_city=None,
            shipping_state=None,
            shipping_postal_code=None,
            extras={},
            source_row_key="k-exp|exp@cornell.edu",
            warnings=[],
        ),
    )
    expired.expires_at = _now() - timedelta(days=1)
    await db_session.flush()
    assert (
        await deliver_saved_prefill_email(
            db_session,
            invite_email="exp@cornell.edu",
            org_name="Expired Org",
            apply_url=f"https://www.example.com/org/apply?prefill={exp_raw}",
        )
        == "skipped_not_live"
    )


async def test_prefill_get_and_apply_marks_used(app_client: AsyncClient, db_session) -> None:
    parsed = ParsedPrefill(
        invite_email="greeks@cornell.edu",
        edu_email="greeks@cornell.edu",
        contact_name="Alex",
        org_name="Campus Greeks",
        university="Cornell University",
        member_count=40,
        category="sorority",
        instagram_handle="campusgreeks",
        shipping_raw="123 College Ave, Ithaca, NY 14850",
        shipping_line1="123 College Ave",
        shipping_line2=None,
        shipping_city="Ithaca",
        shipping_state="NY",
        shipping_postal_code="14850",
        extras={"phone": "1"},
        source_row_key="k1|greeks@cornell.edu",
        warnings=[],
    )
    row, raw = await insert_prefill(db_session, parsed)
    await db_session.flush()

    missing = await app_client.get("/api/orgs/apply/prefill", params={"token": "nope"})
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == errors.NOT_FOUND

    got = await app_client.get("/api/orgs/apply/prefill", params={"token": raw})
    assert got.status_code == 200
    data = got.json()["data"]
    assert data["orgName"] == "Campus Greeks"
    assert data["instagramHandle"] == "campusgreeks"
    assert data["shippingRaw"]
    assert "phone" not in data
    assert "inviteEmail" not in data

    again = await app_client.get("/api/orgs/apply/prefill", params={"token": raw})
    assert again.status_code == 200

    resp = await app_client.post("/api/orgs/apply", json={**_APPLY, "prefillToken": raw})
    assert resp.status_code == 200
    await db_session.flush()
    assert row.used_at is not None
    user = await db_session.scalar(select(User).where(User.edu_email == "greeks@cornell.edu"))
    assert row.used_by_user_id == user.id

    spent = await app_client.get("/api/orgs/apply/prefill", params={"token": raw})
    assert spent.status_code == 404


async def test_apply_ignores_bad_prefill_token(app_client: AsyncClient, db_session) -> None:
    resp = await app_client.post(
        "/api/orgs/apply",
        json={**_APPLY, "eduEmail": "other@cornell.edu", "prefillToken": "spent-or-fake"},
    )
    assert resp.status_code == 200


async def test_cleanup_sweeps_org_apply_prefills(db_session) -> None:
    old = _now() - timedelta(days=10)
    db_session.add(
        OrgApplyPrefill(
            id=uuid4(),
            token_hash=hash_token("prefill-old"),
            invite_email="old@cornell.edu",
            expires_at=old,
        )
    )
    await db_session.flush()
    result = await cleanup_tokens(db_session)
    assert result["org_apply_prefills_deleted"] == 1
