"""Email org apply prefill links from a mint sidecar (does not insert).

Do not commit the sidecar. Production requires --confirm.

    poetry run python scripts/send_org_apply_prefills.py path.json
    poetry run python scripts/send_org_apply_prefills.py path.json --confirm
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.config import settings  # noqa: E402
from app.deps.db import async_session_factory, engine  # noqa: E402
from app.services.org_apply_prefill import deliver_saved_prefill_email  # noqa: E402


def _load_sidecar(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = data.get("rows") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        raise ValueError('sidecar must be {"rows": [...]}')
    return rows


async def _run(*, path: Path, resend: bool) -> dict:
    rows = _load_sidecar(path)
    sent = 0
    skipped = 0
    failed = 0
    details: list[dict] = []

    async with async_session_factory() as db:
        for item in rows:
            if not isinstance(item, dict):
                skipped += 1
                details.append({"status": "skipped_bad_row"})
                continue
            status = await deliver_saved_prefill_email(
                db,
                invite_email=str(item.get("invite_email") or ""),
                org_name=str(item.get("org_name") or ""),
                apply_url=str(item.get("apply_url") or ""),
                resend=resend,
            )
            details.append(
                {
                    "invite_email": item.get("invite_email"),
                    "org_name": item.get("org_name"),
                    "status": status,
                }
            )
            if status == "sent":
                sent += 1
            elif status == "send_failed":
                failed += 1
            else:
                skipped += 1
        await db.commit()

    await engine.dispose()
    return {
        "sent": sent,
        "skipped": skipped,
        "failed": failed,
        "rows": details,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "path",
        type=Path,
        help="Sidecar JSON from import --write --out (do not commit).",
    )
    parser.add_argument(
        "--resend",
        action="store_true",
        help="Mail even if email_sent_at is already set (same URL).",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Required when ENVIRONMENT=production.",
    )
    args = parser.parse_args()
    if settings.ENVIRONMENT == "production" and not args.confirm:
        print(
            "refusing: ENVIRONMENT=production send requires --confirm after explicit ops OK.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    if not args.path.is_file():
        print(f"refusing: no such file {args.path}", file=sys.stderr)
        raise SystemExit(2)
    try:
        result = asyncio.run(_run(path=args.path, resend=bool(args.resend)))
    except ValueError as exc:
        print(f"refusing: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
    print(json.dumps(result, default=str, indent=2))


if __name__ == "__main__":
    main()
