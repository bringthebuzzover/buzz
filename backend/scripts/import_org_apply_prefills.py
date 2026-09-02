"""Import Google Form / CSV rows as org apply prefills (mint only).

Does not create users. Does not send mail. Default is dry-run (parse + print
JSON without secrets). Do not commit the sheet or the --out sidecar (PII /
link secrets). Keep them local under scripts/fixtures/ (gitignored).

    poetry run python scripts/import_org_apply_prefills.py path.csv
    poetry run python scripts/import_org_apply_prefills.py path.csv --write --out path.json

Raw tokens cannot be recovered later — only the hash is stored. Mail later
with send_org_apply_prefills.py and the sidecar.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import io
import json
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.deps.db import async_session_factory, engine  # noqa: E402
from app.services.org_apply_prefill import (  # noqa: E402
    apply_url_for_token,
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
    first_line = text.splitlines()[0] if text else ""
    dialect = csv.excel_tab if "\t" in first_line else csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    rows = [list(r) for r in reader if any((c or "").strip() for c in r)]
    if rows and _looks_like_header(rows[0]):
        rows = rows[1:]
    return rows


def _parsed_summary(parsed, *, skipped: str | None = None) -> dict:
    return {
        "invite_email": parsed.invite_email,
        "edu_email": parsed.edu_email,
        "contact_name": parsed.contact_name,
        "org_name": parsed.org_name,
        "university": parsed.university,
        "member_count": parsed.member_count,
        "category": parsed.category,
        "instagram_handle": parsed.instagram_handle,
        "shipping_line1": parsed.shipping_line1,
        "shipping_line2": parsed.shipping_line2,
        "shipping_city": parsed.shipping_city,
        "shipping_state": parsed.shipping_state,
        "shipping_postal_code": parsed.shipping_postal_code,
        "warnings": parsed.warnings,
        "source_row_key": parsed.source_row_key,
        "skipped": skipped,
    }


def write_prefill_sidecar(path: Path, rows: list[dict]) -> None:
    path.write_text(
        json.dumps({"rows": rows}, indent=2) + "\n",
        encoding="utf-8",
    )


async def _run(*, path: Path, write: bool, out: Path | None) -> dict:
    rows = read_sheet_rows(path)
    created = 0
    skipped = 0
    details: list[dict] = []
    sidecar_rows: list[dict] = []

    async with async_session_factory() as db:
        for cells in rows:
            parsed = parse_form_row(cells)
            if not parsed.invite_email:
                skipped += 1
                details.append({"warnings": ["missing_invite_email"], "skipped": "missing_email"})
                continue
            existing = await find_by_source_row_key(db, parsed.source_row_key)
            if existing is not None:
                skipped += 1
                details.append(_parsed_summary(parsed, skipped="duplicate_source_row_key"))
                continue
            if not write:
                details.append(_parsed_summary(parsed))
                continue
            _row, raw = await insert_prefill(db, parsed)
            created += 1
            apply_url = apply_url_for_token(raw)
            sidecar_rows.append(
                {
                    "invite_email": parsed.invite_email,
                    "org_name": parsed.org_name or "",
                    "apply_url": apply_url,
                }
            )
            details.append(_parsed_summary(parsed))
        if write:
            await db.commit()

    await engine.dispose()
    if write and out is not None:
        write_prefill_sidecar(out, sidecar_rows)
    return {
        "dry_run": not write,
        "created": created,
        "skipped": skipped,
        "out": str(out) if write and out is not None else None,
        "rows": details,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "path",
        type=Path,
        help="Local CSV/TSV of form rows (do not commit; gitignored under scripts/fixtures/).",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Insert prefill rows (requires --out). Does not email.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        help="Write apply URLs here (required with --write). Gitignored JSON.",
    )
    args = parser.parse_args()
    if args.write and args.out is None:
        print("refusing: --write requires --out <path.json>", file=sys.stderr)
        raise SystemExit(2)
    if not args.path.is_file():
        print(f"refusing: no such file {args.path}", file=sys.stderr)
        raise SystemExit(2)
    result = asyncio.run(_run(path=args.path, write=bool(args.write), out=args.out))
    print(json.dumps(result, default=str, indent=2))


if __name__ == "__main__":
    main()
