"""US shipping-address verification (org.shipping-address-unverified).

Production uses Google Places Autocomplete (New) + Address Validation with
the key on the server only. Development with an empty key uses a format
fallback (structured US fields + ZIP) so CI/E2E do not need billing.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

import httpx

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException

US_STATE_CODES = frozenset(
    {
        "AL",
        "AK",
        "AZ",
        "AR",
        "CA",
        "CO",
        "CT",
        "DE",
        "DC",
        "FL",
        "GA",
        "HI",
        "ID",
        "IL",
        "IN",
        "IA",
        "KS",
        "KY",
        "LA",
        "ME",
        "MD",
        "MA",
        "MI",
        "MN",
        "MS",
        "MO",
        "MT",
        "NE",
        "NV",
        "NH",
        "NJ",
        "NM",
        "NY",
        "NC",
        "ND",
        "OH",
        "OK",
        "OR",
        "PA",
        "RI",
        "SC",
        "SD",
        "TN",
        "TX",
        "UT",
        "VT",
        "VA",
        "WA",
        "WV",
        "WI",
        "WY",
    }
)
_ZIP_RE = re.compile(r"^\d{5}(?:-\d{4})?$")
_INVALID_MSG = (
    "Enter a US mailing address brands can ship to (street or PO Box, city, "
    "state, and ZIP). Campus city/state is separate."
)


@dataclass(frozen=True)
class AddressSuggestion:
    place_id: str
    text: str


@dataclass(frozen=True)
class StructuredAddress:
    line1: str
    line2: str | None
    city: str
    state: str
    postal_code: str
    formatted: str
    place_id: str | None = None


def format_us_address(
    line1: str,
    line2: str | None,
    city: str,
    state: str,
    postal_code: str,
) -> str:
    street = line1 if not line2 else f"{line1}, {line2}"
    return f"{street}, {city}, {state} {postal_code}"


def _normalize_state(raw: str) -> str:
    return raw.strip().upper()


def assert_us_format(
    line1: str,
    line2: str | None,
    city: str,
    state: str,
    postal_code: str,
) -> StructuredAddress:
    """Reject garbage without calling Google (dev fallback + pre-check)."""

    line1 = line1.strip()
    line2_n = (line2 or "").strip() or None
    city = city.strip()
    state = _normalize_state(state)
    postal_code = postal_code.strip()
    if len(line1) < 3 or not city or state not in US_STATE_CODES:
        raise BuzzAPIException(errors.INVALID_SHIPPING_ADDRESS, _INVALID_MSG, status_code=400)
    if not _ZIP_RE.match(postal_code):
        raise BuzzAPIException(
            errors.INVALID_SHIPPING_ADDRESS,
            "ZIP must be 5 digits or ZIP+4.",
            status_code=400,
        )
    if line1.lower() in {"asdf", "n/a", "na", "none", "test"}:
        raise BuzzAPIException(errors.INVALID_SHIPPING_ADDRESS, _INVALID_MSG, status_code=400)
    return StructuredAddress(
        line1=line1,
        line2=line2_n,
        city=city,
        state=state,
        postal_code=postal_code,
        formatted=format_us_address(line1, line2_n, city, state, postal_code),
    )


@runtime_checkable
class AddressClient(Protocol):
    async def suggest(self, query: str) -> list[AddressSuggestion]: ...

    async def preview(self, place_id: str) -> StructuredAddress: ...

    async def validate(
        self,
        *,
        line1: str,
        line2: str | None,
        city: str,
        state: str,
        postal_code: str,
        place_id: str | None = None,
    ) -> StructuredAddress: ...


class FormatFallbackAddressClient:
    """Structured US format only — used when ``GOOGLE_ADDRESS_API_KEY`` is empty."""

    async def suggest(self, query: str) -> list[AddressSuggestion]:
        return []

    async def preview(self, place_id: str) -> StructuredAddress:
        raise BuzzAPIException(
            errors.INVALID_SHIPPING_ADDRESS,
            "Address suggestions need Google Places. Type the street, city, state, and ZIP.",
            status_code=400,
        )

    async def validate(
        self,
        *,
        line1: str,
        line2: str | None,
        city: str,
        state: str,
        postal_code: str,
        place_id: str | None = None,
    ) -> StructuredAddress:
        addr = assert_us_format(line1, line2, city, state, postal_code)
        return StructuredAddress(
            line1=addr.line1,
            line2=addr.line2,
            city=addr.city,
            state=addr.state,
            postal_code=addr.postal_code,
            formatted=addr.formatted,
            place_id=place_id,
        )


class HttpGoogleAddressClient:
    """Places Autocomplete (New) + Address Validation. Key never leaves the API."""

    def __init__(self, http: httpx.AsyncClient | None = None) -> None:
        self._http = http or httpx.AsyncClient(timeout=10.0)
        self._owns = http is None

    async def aclose(self) -> None:
        if self._owns:
            await self._http.aclose()

    def _headers(self) -> dict[str, str]:
        return {
            "X-Goog-Api-Key": settings.GOOGLE_ADDRESS_API_KEY,
            "Content-Type": "application/json",
        }

    async def suggest(self, query: str) -> list[AddressSuggestion]:
        q = query.strip()
        if len(q) < 3:
            return []
        try:
            resp = await self._http.post(
                "https://places.googleapis.com/v1/places:autocomplete",
                headers={
                    **self._headers(),
                    "X-Goog-FieldMask": "suggestions.placePrediction.placeId,"
                    "suggestions.placePrediction.text",
                },
                json={"input": q, "includedRegionCodes": ["us"]},
            )
        except httpx.HTTPError:
            raise BuzzAPIException(
                errors.ADDRESS_PROVIDER_UNAVAILABLE,
                "Address lookup is temporarily unavailable. Try again.",
                status_code=503,
            ) from None
        if resp.status_code >= 400:
            raise BuzzAPIException(
                errors.ADDRESS_PROVIDER_UNAVAILABLE,
                "Address lookup is temporarily unavailable. Try again.",
                status_code=503,
            )
        out: list[AddressSuggestion] = []
        for item in resp.json().get("suggestions") or []:
            pred = item.get("placePrediction") or {}
            pid = (pred.get("placeId") or "").strip()
            text_obj = pred.get("text") or {}
            text = (text_obj.get("text") if isinstance(text_obj, dict) else None) or ""
            if pid and text:
                out.append(AddressSuggestion(place_id=pid, text=text))
        return out

    async def preview(self, place_id: str) -> StructuredAddress:
        pid = place_id.strip().removeprefix("places/")
        if not pid:
            raise BuzzAPIException(errors.INVALID_SHIPPING_ADDRESS, _INVALID_MSG, status_code=400)
        try:
            resp = await self._http.get(
                f"https://places.googleapis.com/v1/places/{pid}",
                headers={
                    **self._headers(),
                    "X-Goog-FieldMask": "id,formattedAddress,addressComponents",
                },
            )
        except httpx.HTTPError:
            raise BuzzAPIException(
                errors.ADDRESS_PROVIDER_UNAVAILABLE,
                "Address lookup is temporarily unavailable. Try again.",
                status_code=503,
            ) from None
        if resp.status_code >= 400:
            raise BuzzAPIException(errors.INVALID_SHIPPING_ADDRESS, _INVALID_MSG, status_code=400)
        parsed = _from_place_components(resp.json())
        return await self.validate(
            line1=parsed.line1,
            line2=parsed.line2,
            city=parsed.city,
            state=parsed.state,
            postal_code=parsed.postal_code,
            place_id=pid,
        )

    async def validate(
        self,
        *,
        line1: str,
        line2: str | None,
        city: str,
        state: str,
        postal_code: str,
        place_id: str | None = None,
    ) -> StructuredAddress:
        pre = assert_us_format(line1, line2, city, state, postal_code)
        lines = [pre.line1]
        if pre.line2:
            lines.append(pre.line2)
        try:
            resp = await self._http.post(
                "https://addressvalidation.googleapis.com/v1:validateAddress",
                headers=self._headers(),
                json={
                    "address": {
                        "regionCode": "US",
                        "addressLines": lines,
                        "locality": pre.city,
                        "administrativeArea": pre.state,
                        "postalCode": pre.postal_code,
                    }
                },
            )
        except httpx.HTTPError:
            raise BuzzAPIException(
                errors.ADDRESS_PROVIDER_UNAVAILABLE,
                "Could not verify that mailing address. Try again.",
                status_code=503,
            ) from None
        if resp.status_code >= 400:
            raise BuzzAPIException(
                errors.ADDRESS_PROVIDER_UNAVAILABLE,
                "Could not verify that mailing address. Try again.",
                status_code=503,
            )
        return _from_validation(resp.json(), fallback=pre, place_id=place_id)


def _component_map(components: list[dict[str, object]]) -> dict[str, str]:
    by_type: dict[str, str] = {}
    for comp in components:
        types = comp.get("types") or []
        if not isinstance(types, list):
            continue
        long_text = str(comp.get("longText") or comp.get("long_name") or "")
        short_text = str(comp.get("shortText") or comp.get("short_name") or long_text)
        for t in types:
            if isinstance(t, str) and t not in by_type:
                by_type[t] = short_text if t == "administrative_area_level_1" else long_text
                if t == "administrative_area_level_1":
                    by_type[t] = short_text
    return by_type


def _from_place_components(body: dict[str, object]) -> StructuredAddress:
    comps = body.get("addressComponents") or []
    if not isinstance(comps, list):
        comps = []
    by_type = _component_map([c for c in comps if isinstance(c, dict)])
    street_num = by_type.get("street_number", "")
    route = by_type.get("route", "")
    line1 = f"{street_num} {route}".strip() or str(body.get("formattedAddress") or "")
    line2 = by_type.get("subpremise") or None
    city = by_type.get("locality") or by_type.get("sublocality") or ""
    state = _normalize_state(by_type.get("administrative_area_level_1") or "")
    postal = by_type.get("postal_code", "")
    plus = by_type.get("postal_code_suffix")
    if plus and "-" not in postal:
        postal = f"{postal}-{plus}"
    return assert_us_format(line1, line2, city, state, postal)


def _as_dict(value: object) -> dict[str, object]:
    return value if isinstance(value, dict) else {}


def _from_validation(
    body: dict[str, object],
    *,
    fallback: StructuredAddress,
    place_id: str | None,
) -> StructuredAddress:
    result = _as_dict(body.get("result"))
    verdict = _as_dict(result.get("verdict"))
    complete = bool(verdict.get("addressComplete"))
    granularity = str(verdict.get("validationGranularity") or "")
    usps = _as_dict(result.get("uspsData"))
    postal = _as_dict(result.get("address"))
    pa = _as_dict(postal.get("postalAddress"))

    region = str(pa.get("regionCode") or "US").upper()
    if region and region != "US":
        raise BuzzAPIException(
            errors.INVALID_SHIPPING_ADDRESS,
            "Shipping is US-only (including PO Boxes and campus CPO).",
            status_code=400,
        )
    if not complete and not usps:
        raise BuzzAPIException(errors.INVALID_SHIPPING_ADDRESS, _INVALID_MSG, status_code=400)
    if granularity in {"ROUTE", "OTHER", "GRANULARITY_UNSPECIFIED"} and not usps:
        raise BuzzAPIException(errors.INVALID_SHIPPING_ADDRESS, _INVALID_MSG, status_code=400)

    raw_lines = pa.get("addressLines")
    lines = raw_lines if isinstance(raw_lines, list) else []
    line1 = str(lines[0]).strip() if lines else fallback.line1
    extra = [str(x).strip() for x in lines[1:] if str(x).strip()]
    line2 = ", ".join(extra) if extra else fallback.line2
    city = str(pa.get("locality") or fallback.city).strip()
    state = _normalize_state(str(pa.get("administrativeArea") or fallback.state))
    zipc = str(pa.get("postalCode") or fallback.postal_code).strip()
    addr = assert_us_format(line1, line2, city, state, zipc)
    return StructuredAddress(
        line1=addr.line1,
        line2=addr.line2,
        city=addr.city,
        state=addr.state,
        postal_code=addr.postal_code,
        formatted=addr.formatted,
        place_id=place_id,
    )


_fallback = FormatFallbackAddressClient()
_google: HttpGoogleAddressClient | None = None


def get_address_client() -> AddressClient:
    """FastAPI dependency. Tests override this."""

    global _google
    if settings.GOOGLE_ADDRESS_API_KEY:
        if _google is None:
            _google = HttpGoogleAddressClient()
        return _google
    return _fallback


async def close_address_client() -> None:
    global _google
    if _google is not None:
        await _google.aclose()
        _google = None


def apply_to_org(org: object, addr: StructuredAddress) -> None:
    """Write structured columns + formatted ``delivery_address`` blob."""

    org.shipping_line1 = addr.line1  # type: ignore[attr-defined]
    org.shipping_line2 = addr.line2  # type: ignore[attr-defined]
    org.shipping_city = addr.city  # type: ignore[attr-defined]
    org.shipping_state = addr.state  # type: ignore[attr-defined]
    org.shipping_postal_code = addr.postal_code  # type: ignore[attr-defined]
    org.delivery_address = addr.formatted  # type: ignore[attr-defined]
