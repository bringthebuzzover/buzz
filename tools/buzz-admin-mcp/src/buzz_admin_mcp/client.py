"""HTTP client for the Buzz admin API (cookie refresh + Bearer access)."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

DEFAULT_API_URL = "https://api.bringthebuzzover.com"


class BuzzAdminError(RuntimeError):
    """Admin API call failed."""


class BuzzAdminClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        email: str | None = None,
        password: str | None = None,
    ) -> None:
        self.base_url = (base_url or os.environ.get("BUZZ_API_URL") or DEFAULT_API_URL).rstrip(
            "/"
        )
        self.email = email or os.environ.get("BUZZ_ADMIN_EMAIL", "")
        self.password = password or os.environ.get("BUZZ_ADMIN_PASSWORD", "")
        self._access = os.environ.get("BUZZ_ADMIN_ACCESS_TOKEN", "")
        self._http = httpx.Client(base_url=self.base_url, timeout=30.0, follow_redirects=True)

    def close(self) -> None:
        self._http.close()

    def ensure_auth(self) -> None:
        if self._access:
            return
        if not self.email or not self.password:
            raise BuzzAdminError(
                "Set BUZZ_ADMIN_EMAIL + BUZZ_ADMIN_PASSWORD (or BUZZ_ADMIN_ACCESS_TOKEN)."
            )
        self._login()

    def _login(self) -> None:
        response = self._http.post(
            "/api/auth/admin/login",
            json={"email": self.email, "password": self.password},
        )
        self._access = self._read_access(response, "admin login")

    def _refresh(self) -> None:
        response = self._http.post("/api/auth/refresh")
        if response.status_code == 401:
            self._login()
            return
        self._access = self._read_access(response, "refresh")

    def _read_access(self, response: httpx.Response, label: str) -> str:
        payload = _json(response)
        if response.status_code >= 400:
            raise BuzzAdminError(_error_text(payload, label, response.status_code))
        data = payload.get("data") if isinstance(payload, dict) else None
        token = data.get("accessToken") if isinstance(data, dict) else None
        if not token:
            raise BuzzAdminError(f"{label} returned no accessToken.")
        return str(token)

    def request(
        self,
        method: str,
        path: str,
        *,
        json_body: Any | None = None,
        params: dict[str, Any] | None = None,
    ) -> Any:
        self.ensure_auth()
        response = self._http.request(
            method,
            path,
            json=json_body,
            params=params,
            headers={"Authorization": f"Bearer {self._access}"},
        )
        if response.status_code == 401:
            self._refresh()
            response = self._http.request(
                method,
                path,
                json=json_body,
                params=params,
                headers={"Authorization": f"Bearer {self._access}"},
            )
        payload = _json(response)
        if response.status_code >= 400:
            raise BuzzAdminError(_error_text(payload, f"{method} {path}", response.status_code))
        if isinstance(payload, dict) and "data" in payload:
            return payload["data"]
        return payload


def _json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except json.JSONDecodeError:
        return {"raw": response.text}


def _error_text(payload: Any, label: str, status: int) -> str:
    if isinstance(payload, dict):
        err = payload.get("error")
        if isinstance(err, dict):
            code = err.get("code") or ""
            message = err.get("message") or payload
            return f"{label} failed ({status} {code}): {message}"
    return f"{label} failed ({status}): {payload}"
