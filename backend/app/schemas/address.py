"""Shared US shipping-address request/response fields."""

from __future__ import annotations

from app.schemas.common import CamelModel


class AddressSuggestionItem(CamelModel):
    place_id: str
    text: str


class AddressSuggestResponse(CamelModel):
    suggestions: list[AddressSuggestionItem]


class AddressPreviewResponse(CamelModel):
    shipping_line1: str
    shipping_line2: str | None = None
    shipping_city: str
    shipping_state: str
    shipping_postal_code: str
    delivery_address: str
