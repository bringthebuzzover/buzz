"""Import Google Form / CSV rows as org apply prefills.

Does not create users. Default is dry-run (parse + print JSON).

    poetry run python scripts/import_org_apply_prefills.py path.csv --dry-run
    poetry run python scripts/import_org_apply_prefills.py path.csv --write
    poetry run python scripts/import_org_apply_prefills.py path.csv --write --send
    poetry run python scripts/import_org_apply_prefills.py path.csv --write --send --confirm
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.config import settings  # noqa: E402
from app.deps.db import async_session_factory, engine  # noqa: E402
from app.services.email import send_org_apply_prefill_email  # noqa: E402
from app.services.org_apply_prefill import (  # noqa: E402
    find_by_source_row_key,
    insert_prefill,
)
from app.services.org_apply_prefill_parse import parse_form_row  # noqa: E402


def _looks_like_header(row: list[str]) -> bool:
    if not row:
        return False
    first = (row[0] or "").strip().lower()
    return first in {"timestamp", "email"} or "timestamp" in first


def read_sheet_rows(path: Path) -> list[list[str]]:
    text = path.read_text(encoding="utf-8-sig")
    dialect = csv.excel_tab if "\t" in text.splitlines()[0] else csv.excel
    reader = csv.reader(text.splitlines(), dialect)
    rows = [list(r) for r in reader if any((c or "").strip() for c in r)]
    if rows and _looks_like_header(rows[0]):
        rows = rows[1:]
    return rows


def _parsed_summary(parsed, *, skipped: str | None = None) -> dict:
    return {
        "invite_email": parsed.invite_email,
        "edu_email": parsed.edu_email,
        "org_name": parsed.org_name,
        "university": parsed.university,
        "instagram_handle": parsed.instagram_handle,
        "warnings": parsed.warnings,
        "source_row_key": parsed.source_row_key,
        "skipped": skipped,
    }


async def _run(*, path: Path, write: bool, send: bool, force: bool) -> dict:
    rows = read_sheet_rows(path)
    created = 0
    skipped = 0
    emailed = 0
    details: list[dict] = []

    async with async_session_factory() as db:
        for cells in rows:
            parsed = parse_form_row(cells)
            if not parsed.invite_email:
                skipped += 1
                details.append({"warnings": ["missing_invite_email"], "skipped": "missing_email"})
                continue
            existing = await find_by_source_row_key(db, parsed.source_row_key)
            if existing is not None and not force:
                skipped += 1
                details.append(_parsed_summary(parsed, skipped="duplicate_source_row_key"))
                continue
            if not write:
                details.append(_parsed_summary(parsed))
                continue
            _row, raw = await insert_prefill(db, parsed)
            created += 1
            emailed_ok = False
            if send:
                emailed_ok = await send_org_apply_prefill_email(
                    parsed.invite_email,
                    raw,
                    org_name=parsed.org_name or "",
                )
                if emailed_ok:
                    emailed += 1
            details.append({**_parsed_summary(parsed), "emailed": emailed_ok if send else False})
        if write:
            await db.commit()

    await engine.dispose()
    return {
        "dry_run": not write,
        "created": created,
        "skipped": skipped,
        "emailed": emailed,
        "rows": details,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path, help="CSV or TSV export (do not commit).")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse only (default when --write/--send omitted).",
    )
    parser.add_argument("--write", action="store_true", help="Insert prefill rows.")
    parser.add_argument(
        "--send",
        action="store_true",
        help="Email prefill links (implies --write).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Insert even if source_row_key exists.",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Required for --send when ENVIRONMENT=production.",
    )
    args = parser.parse_args()
    write = bool(args.write or args.send)
    if args.send and settings.ENVIRONMENT == "production" and not args.confirm:
        print(
            "refusing: ENVIRONMENT=production --send requires --confirm after explicit ops OK.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    if not args.path.is_file():
        print(f"refusing: no such file {args.path}", file=sys.stderr)
        raise SystemExit(2)
    result = asyncio.run(
        _run(path=args.path, write=write, send=bool(args.send), force=bool(args.force))
    )
    print(json.dumps(result, default=str, indent=2))


if __name__ == "__main__":
    main()
