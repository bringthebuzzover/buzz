"""Envelope-shape unit tests.

Locks the contract from `architecture.md` §5.2: success responses carry
`error=None`, errors carry `data=None` and `meta=None`. Five tests cover
the matrix the doc calls out.
"""

from __future__ import annotations

from app.response import (
    APIResponse,
    ErrorDetail,
    api_error_response,
    api_response,
)


def test_success_without_meta() -> None:
    envelope = api_response(data={"hello": "world"})
    assert isinstance(envelope, APIResponse)
    assert envelope.data == {"hello": "world"}
    assert envelope.meta is None
    assert envelope.error is None


def test_success_with_meta_pagination() -> None:
    meta = {"page": 1, "per_page": 25, "total": 100}
    envelope = api_response(data=[1, 2, 3], meta=meta)
    assert envelope.data == [1, 2, 3]
    assert envelope.meta == meta
    assert envelope.error is None


def test_error_without_details() -> None:
    envelope = api_error_response(code="UNAUTHORIZED", message="Missing token")
    assert envelope.data is None
    assert envelope.meta is None
    assert envelope.error is not None
    assert envelope.error.code == "UNAUTHORIZED"
    assert envelope.error.message == "Missing token"
    assert envelope.error.details is None


def test_error_with_details() -> None:
    details = {"unit_budget_remaining": 0, "requested": 3}
    envelope = api_error_response(
        code="UNIT_BUDGET_EXCEEDED",
        message="Allocation exceeds remaining budget.",
        details=details,
    )
    assert envelope.error is not None
    assert envelope.error.code == "UNIT_BUDGET_EXCEEDED"
    assert envelope.error.details == details


def test_error_detail_model_dump_shape() -> None:
    err = ErrorDetail(code="NOT_FOUND", message="Drop not found")
    dumped = err.model_dump()
    assert dumped == {"code": "NOT_FOUND", "message": "Drop not found", "details": None}
