"""Dump the OpenAPI spec to ``openapi.json`` at the repo root — no server needed.

The frontend generates its API types from this file (``npm run gen:api``), so the
backend stays the single source of truth for the request/response contract. Run
this whenever a route's request/response schema changes; CI verifies the
committed spec is up to date.

Usage::

    cd backend && poetry run python scripts/dump_openapi.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.main import app  # noqa: E402

_REPO_ROOT = _BACKEND_ROOT.parent
_OUT = _REPO_ROOT / "openapi.json"


def main() -> None:
    spec = app.openapi()
    _OUT.write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n")
    print(f"wrote {_OUT.relative_to(_REPO_ROOT)} ({len(spec.get('paths', {}))} paths)")


if __name__ == "__main__":
    main()
