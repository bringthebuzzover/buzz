"""Graph client must not chain httpx exceptions (token URLs in __cause__)."""

from __future__ import annotations

from unittest.mock import AsyncMock

import httpx
import pytest

from app.exceptions import BuzzAPIException
from app.services.instagram import HttpInstagramClient


@pytest.mark.asyncio
async def test_graph_http_error_has_no_httpx_cause(monkeypatch) -> None:
    client = HttpInstagramClient()
    mock_http = AsyncMock()
    req = httpx.Request(
        "GET",
        "https://graph.instagram.com/me?access_token=SECRET_TOKEN_VALUE",
    )
    resp = httpx.Response(500, request=req)
    mock_http.get.side_effect = httpx.HTTPStatusError(
        "boom",
        request=req,
        response=resp,
    )
    monkeypatch.setattr(client, "_client", AsyncMock(return_value=mock_http))

    with pytest.raises(BuzzAPIException) as caught:
        await client.fetch_profile("SECRET_TOKEN_VALUE")

    assert caught.value.__cause__ is None
    text = f"{caught.value!s}{caught.value.message}"
    assert "SECRET_TOKEN_VALUE" not in text
    assert "access_token" not in text
