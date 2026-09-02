"""Normalize Google Form / CSV rows into org apply prefill drafts."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

from app.services.address import US_STATE_CODES
from app.services.instagram import canonical_instagram_handle

_HANDLE_RE = re.compile(r"^(?!.*\.\.)(?!\.)[A-Za-z0-9._]{1,30}(?<!\.)$")

PREFILL_TTL_DAYS = 30
DEFAULT_CATEGORY = "sorority"

# Trailing sheet column like 1k / 2.2k — drop, do not store.
_K_COLUMN_RE = re.compile(r"^\d+(\.\d+)?k$", re.IGNORECASE)
_ZIP_RE = re.compile(r"\b(\d{5})(?:-\d{4})?\b")
_BOX_RE = re.compile(r"\b(box|cpo)\b|#\s*\d", re.IGNORECASE)
_MEMBER_RE = re.compile(r"\d+")

_IG_PATH_SKIP = frozenset({"p", "reel", "reels", "stories", "tv", "explore", "accounts"})

_STATE_NAME_TO_CODE: dict[str, str] = {
    "alabama": "AL",
    "alaska": "AK",
    "arizona": "AZ",
    "arkansas": "AR",
    "california": "CA",
    "colorado": "CO",
    "connecticut": "CT",
    "delaware": "DE",
    "district of columbia": "DC",
    "florida": "FL",
    "georgia": "GA",
    "hawaii": "HI",
    "idaho": "ID",
    "illinois": "IL",
    "indiana": "IN",
    "iowa": "IA",
    "kansas": "KS",
    "kentucky": "KY",
    "louisiana": "LA",
    "maine": "ME",
    "maryland": "MD",
    "massachusetts": "MA",
    "michigan": "MI",
    "minnesota": "MN",
    "mississippi": "MS",
    "missouri": "MO",
    "montana": "MT",
    "nebraska": "NE",
    "nevada": "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    "ohio": "OH",
    "oklahoma": "OK",
    "oregon": "OR",
    "pennsylvania": "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    "tennessee": "TN",
    "texas": "TX",
    "utah": "UT",
    "vermont": "VT",
    "virginia": "VA",
    "washington": "WA",
    "west virginia": "WV",
    "wisconsin": "WI",
    "wyoming": "WY",
}


@dataclass
class ParsedPrefill:
    invite_email: str
    edu_email: str | None
    contact_name: str | None
    org_name: str | None
    university: str | None
    member_count: int | None
    category: str
    instagram_handle: str | None
    shipping_raw: str | None
    shipping_line1: str | None
    shipping_line2: str | None
    shipping_city: str | None
    shipping_state: str | None
    shipping_postal_code: str | None
    extras: dict[str, Any]
    source_row_key: str | None
    warnings: list[str] = field(default_factory=list)


def _blank(value: str | None) -> str | None:
    if value is None:
        return None
    v = value.strip()
    return v or None


def edu_email_if_edu(email: str) -> str | None:
    v = email.strip().lower()
    if v.count("@") != 1:
        return None
    local, _, domain = v.partition("@")
    if not local or not domain.endswith(".edu") or len(domain) <= len(".edu"):
        return None
    return v


def parse_member_count(raw: str | None) -> int | None:
    text = (raw or "").strip()
    if not text:
        return None
    m = _MEMBER_RE.search(text.replace(",", ""))
    if m is None:
        return None
    return int(m.group(0))


def split_org_university(raw: str | None, warnings: list[str]) -> tuple[str | None, str | None]:
    text = (raw or "").strip()
    if not text:
        return None, None
    if "," not in text:
        warnings.append("unsplit_org_university")
        return None, None
    left, right = text.split(",", 1)
    university = _blank(left)
    org_name = _blank(right)
    if not university or not org_name:
        warnings.append("unsplit_org_university")
        return None, None
    return org_name, university


def handle_from_instagram_field(raw: str | None) -> str | None:
    text = (raw or "").strip()
    if not text:
        return None
    candidate = text
    if "instagram.com" in text.lower() or "://" in text:
        parsed = urlparse(text if "://" in text else f"https://{text}")
        parts = [p for p in parsed.path.split("/") if p]
        if not parts or parts[0].lower() in _IG_PATH_SKIP:
            return None
        candidate = parts[0]
    handle = canonical_instagram_handle(candidate)
    if not handle or not _HANDLE_RE.match(handle):
        return None
    return handle.lower()


def _state_code(token: str) -> str | None:
    t = token.strip().rstrip(",.")
    if len(t) == 2 and t.upper() in US_STATE_CODES:
        return t.upper()
    return _STATE_NAME_TO_CODE.get(t.lower())


def parse_shipping(raw: str | None) -> dict[str, str | None]:
    shipping_raw = _blank(raw)
    empty = {
        "shipping_raw": shipping_raw,
        "shipping_line1": None,
        "shipping_line2": None,
        "shipping_city": None,
        "shipping_state": None,
        "shipping_postal_code": None,
    }
    if not shipping_raw:
        return empty

    lines = [ln.strip().strip('"') for ln in shipping_raw.replace("\r\n", "\n").split("\n")]
    lines = [ln for ln in lines if ln]
    line2: str | None = None
    kept: list[str] = []
    for ln in lines:
        if line2 is None and _BOX_RE.search(ln) and kept:
            line2 = ln
            continue
        kept.append(ln)
    blob = " ".join(kept)

    zips = list(_ZIP_RE.finditer(blob))
    zip_m = zips[-1] if zips else None
    postal = zip_m.group(0) if zip_m else None
    before_zip = blob[: zip_m.start()].strip().rstrip(",") if zip_m else blob

    state: str | None = None
    city: str | None = None
    line1: str | None = None

    parts = [p.strip() for p in before_zip.split(",") if p.strip()]
    if len(parts) >= 2:
        # Last comma-part is usually state (maybe with leftover zip text).
        last = parts[-1]
        last_tokens = last.split()
        if last_tokens:
            # "Tuscaloosa AL" as a single remaining part when zip was its own comma-part
            if len(parts) >= 2 and _state_code(last_tokens[-1]) and len(last_tokens) > 1:
                state = _state_code(last_tokens[-1])
                city = " ".join(last_tokens[:-1])
                line1 = ", ".join(parts[:-1]) or None
            else:
                state = _state_code(last) or _state_code(last_tokens[-1] if last_tokens else "")
                city = parts[-2] if state else None
                line1 = ", ".join(parts[:-2] if state else parts) or None
                if city and _state_code(city.split()[-1]) and len(city.split()) > 1:
                    # "Tuscaloosa AL" in city slot
                    bits = city.split()
                    state = state or _state_code(bits[-1])
                    city = " ".join(bits[:-1])
    else:
        tokens = [t.strip() for t in before_zip.split() if t.strip()]
        state_idx: int | None = None
        i = len(tokens) - 1
        while i >= 0:
            if i >= 1:
                two = f"{tokens[i - 1]} {tokens[i]}"
                code = _state_code(two)
                if code:
                    state = code
                    state_idx = i - 1
                    break
            code = _state_code(tokens[i])
            if code:
                state = code
                state_idx = i
                break
            i -= 1
        if state_idx is not None and state_idx > 0:
            city = tokens[state_idx - 1]
            line1 = " ".join(tokens[: state_idx - 1]) or None

    return {
        "shipping_raw": shipping_raw,
        "shipping_line1": _blank(line1),
        "shipping_line2": _blank(line2),
        "shipping_city": _blank(city),
        "shipping_state": state,
        "shipping_postal_code": postal.split("-")[0] if postal else None,
    }


def parse_form_row(
    cells: list[str],
    *,
    default_category: str = DEFAULT_CATEGORY,
) -> ParsedPrefill:
    """Parse a sheet row in the documented column order (k-column dropped)."""
    padded = list(cells) + [""] * 12
    timestamp = padded[0]
    email = padded[1]
    contact = padded[2]
    phone = padded[3]
    role = padded[4]
    combined = padded[5]
    shipping = padded[6]
    members = padded[7]
    collab = padded[8]
    notes = padded[9]
    ig = padded[10]
    k_col = padded[11]
    warnings: list[str] = []
    invite = (email or "").strip().lower()
    edu = edu_email_if_edu(invite) if invite else None
    if invite and edu is None:
        warnings.append("edu_email_not_edu")

    org_name, university = split_org_university(combined, warnings)
    extras: dict[str, Any] = {}
    if _blank(combined):
        extras["combined_name"] = combined.strip()
    if _blank(phone):
        extras["phone"] = phone.strip()
    if _blank(role):
        extras["role"] = role.strip()
    if _blank(collab):
        extras["collab"] = collab.strip()
    if _blank(notes):
        extras["notes"] = notes.strip()
    if _blank(k_col) and _K_COLUMN_RE.match(k_col.strip()):
        pass  # drop
    elif _blank(k_col) and not _K_COLUMN_RE.match(k_col.strip()):
        # Unknown trailing cell that is not the k-column — still do not map to Buzz fields.
        extras["dropped_trailing"] = k_col.strip()

    ship = parse_shipping(shipping)
    handle = handle_from_instagram_field(ig)
    key = None
    if _blank(timestamp) and invite:
        key = f"{timestamp.strip()}|{invite}"

    return ParsedPrefill(
        invite_email=invite,
        edu_email=edu,
        contact_name=_blank(contact),
        org_name=org_name,
        university=university,
        member_count=parse_member_count(members),
        category=default_category,
        instagram_handle=handle,
        shipping_raw=ship["shipping_raw"],
        shipping_line1=ship["shipping_line1"],
        shipping_line2=ship["shipping_line2"],
        shipping_city=ship["shipping_city"],
        shipping_state=ship["shipping_state"],
        shipping_postal_code=ship["shipping_postal_code"],
        extras=extras,
        source_row_key=key,
        warnings=warnings,
    )
