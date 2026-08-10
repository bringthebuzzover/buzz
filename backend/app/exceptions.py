"""Domain exception type that maps cleanly to the API envelope.

Route handlers (or services they call) raise `BuzzAPIException` with a stable
code from `app.errors`. The global handler in `app.main` serializes it as
`api_error_response(...)` with the matching HTTP status.
"""

from __future__ import annotations

from typing import Any


class BuzzAPIException(Exception):
    """Raised when an endpoint needs to fail with a typed error code.

    Args:
        code: Stable code from `app.errors` (e.g. `errors.DROP_NOT_OPEN`).
        message: Human-readable message safe for direct display.
        status_code: HTTP status to send. Defaults to 400.
        details: Optional structured context attached to `error.details`.
    """

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details
