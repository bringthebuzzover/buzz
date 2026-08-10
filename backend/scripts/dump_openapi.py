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
from typing import Any

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.main import app  # noqa: E402

_REPO_ROOT = _BACKEND_ROOT.parent
_OUT = _REPO_ROOT / "openapi.json"

# Python 3.12's ``http.HTTPStatus(422).phrase`` is "Unprocessable Entity"; 3.13+
# renamed it to "Unprocessable Content" (HTTP semantics update). FastAPI/Starlette
# copy that phrase into OpenAPI response descriptions, so dumps differ by CPython
# version. Pin one phrase so local (often 3.13) and CI (3.12) stay in sync.
_CANONICAL_422_DESCRIPTION = "Unprocessable Entity"
_422_PHRASE_ALIASES = frozenset({"Unprocessable Entity", "Unprocessable Content"})


def _normalize_422_descriptions(node: Any) -> None:
    """Rewrite 422 response descriptions in-place to a Python-version-stable phrase."""

    if isinstance(node, dict):
        responses = node.get("responses")
        if isinstance(responses, dict):
            resp_422 = responses.get("422")
            if isinstance(resp_422, dict):
                desc = resp_422.get("description")
                if desc in _422_PHRASE_ALIASES:
                    resp_422["description"] = _CANONICAL_422_DESCRIPTION
        for value in node.values():
            _normalize_422_descriptions(value)
    elif isinstance(node, list):
        for item in node:
            _normalize_422_descriptions(item)


def main() -> None:
    spec = app.openapi()
    _normalize_422_descriptions(spec)
    _OUT.write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n")
    print(f"wrote {_OUT.relative_to(_REPO_ROOT)} ({len(spec.get('paths', {}))} paths)")


if __name__ == "__main__":
    main()
