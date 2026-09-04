"""Committed brand email addresses (From + public contact + ops CC).

SOT: ``backend/brand_emails.json``. Not overridable via process env — edit the
JSON and redeploy. ``RESEND_API_KEY`` remains a secret Settings field.
"""

from __future__ import annotations

import json
from pathlib import Path

_BRAND_EMAILS_PATH = Path(__file__).resolve().parents[1] / "brand_emails.json"


def _load() -> tuple[str, str, str]:
    try:
        raw = json.loads(_BRAND_EMAILS_PATH.read_text(encoding="utf-8"))
    except OSError as exc:
        raise RuntimeError(
            f"brand_emails.json missing or unreadable: {_BRAND_EMAILS_PATH}"
        ) from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"brand_emails.json is not valid JSON: {_BRAND_EMAILS_PATH}") from exc
    if not isinstance(raw, dict):
        raise RuntimeError("brand_emails.json must be a JSON object")
    email_from = raw.get("emailFrom")
    contact_email = raw.get("contactEmail")
    ops_cc_email = raw.get("opsCcEmail")
    if not isinstance(email_from, str) or not email_from.strip():
        raise RuntimeError("brand_emails.json: emailFrom must be a non-empty string")
    if not isinstance(contact_email, str) or not contact_email.strip():
        raise RuntimeError("brand_emails.json: contactEmail must be a non-empty string")
    if not isinstance(ops_cc_email, str) or not ops_cc_email.strip():
        raise RuntimeError("brand_emails.json: opsCcEmail must be a non-empty string")
    return email_from.strip(), contact_email.strip(), ops_cc_email.strip()


EMAIL_FROM, CONTACT_EMAIL, OPS_CC_EMAIL = _load()
