"""US shipping-address format + fallback client (org.shipping-address-unverified)."""

from __future__ import annotations

import pytest

from app import errors
from app.exceptions import BuzzAPIException
from app.services.address import (
    FormatFallbackAddressClient,
    StructuredAddress,
    _from_validation,
    assert_us_format,
)


def test_assert_us_format_rejects_asdf() -> None:
    with pytest.raises(BuzzAPIException) as ei:
        assert_us_format("asdf", None, "Ithaca", "NY", "14850")
    assert ei.value.code == errors.INVALID_SHIPPING_ADDRESS


def test_assert_us_format_rejects_bad_zip() -> None:
    with pytest.raises(BuzzAPIException) as ei:
        assert_us_format("1 Campus Rd", None, "Ithaca", "NY", "nope")
    assert ei.value.code == errors.INVALID_SHIPPING_ADDRESS


def test_assert_us_format_accepts_po_box() -> None:
    addr = assert_us_format("PO Box 123", "CPO 400", "Ithaca", "ny", "14850")
    assert addr.state == "NY"
    assert addr.line2 == "CPO 400"
    assert addr.formatted == "PO Box 123, CPO 400, Ithaca, NY 14850"


async def test_fallback_suggest_empty() -> None:
    client = FormatFallbackAddressClient()
    assert await client.suggest("123 Main") == []


async def test_fallback_validate_passthrough() -> None:
    client = FormatFallbackAddressClient()
    addr = await client.validate(
        line1="1 Campus Rd",
        line2=None,
        city="Ithaca",
        state="NY",
        postal_code="14850",
    )
    assert addr.line1 == "1 Campus Rd"


def test_from_validation_rejects_incomplete() -> None:
    fallback = StructuredAddress(
        line1="1 Campus Rd",
        line2=None,
        city="Ithaca",
        state="NY",
        postal_code="14850",
        formatted="1 Campus Rd, Ithaca, NY 14850",
    )
    with pytest.raises(BuzzAPIException) as ei:
        _from_validation(
            {"result": {"verdict": {"addressComplete": False}}},
            fallback=fallback,
            place_id=None,
        )
    assert ei.value.code == errors.INVALID_SHIPPING_ADDRESS


def test_from_validation_accepts_complete() -> None:
    fallback = StructuredAddress(
        line1="1 Campus Rd",
        line2=None,
        city="Ithaca",
        state="NY",
        postal_code="14850",
        formatted="1 Campus Rd, Ithaca, NY 14850",
    )
    addr = _from_validation(
        {
            "result": {
                "verdict": {"addressComplete": True, "validationGranularity": "PREMISE"},
                "address": {
                    "postalAddress": {
                        "regionCode": "US",
                        "addressLines": ["1 Campus Rd"],
                        "locality": "Ithaca",
                        "administrativeArea": "NY",
                        "postalCode": "14850",
                    }
                },
            }
        },
        fallback=fallback,
        place_id="abc",
    )
    assert addr.line1 == "1 Campus Rd"
    assert addr.place_id == "abc"
