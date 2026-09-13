"""Stdio MCP server — Buzz admin tables + panel actions."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

from mcp.server.fastmcp import FastMCP

from buzz_admin_mcp.client import BuzzAdminClient, BuzzAdminError

mcp = FastMCP("buzz-admin")
_client = BuzzAdminClient()


def _dump(value: Any) -> str:
    return json.dumps(value, indent=2, default=str)


def _call(fn: Callable[[], Any]) -> str:
    try:
        return _dump(fn())
    except BuzzAdminError as exc:
        return _dump({"error": str(exc)})


@mcp.tool()
def list_tables() -> str:
    """List Buzz tables and which columns are hidden vs patchable."""
    return _call(lambda: _client.request("GET", "/api/admin/tables"))


@mcp.tool()
def query_rows(
    table: str,
    filters: dict[str, Any] | None = None,
    limit: int = 25,
    offset: int = 0,
) -> str:
    """Query an allowlisted table. Secrets (tokens, hashes, Graph ids) are omitted."""
    return _call(
        lambda: _client.request(
            "POST",
            f"/api/admin/tables/{table}/query",
            json_body={"filters": filters or {}, "limit": limit, "offset": offset},
        )
    )


@mcp.tool()
def get_row(table: str, row_id: str) -> str:
    """Get one row by id. Hidden columns are omitted."""
    return _call(lambda: _client.request("GET", f"/api/admin/tables/{table}/{row_id}"))


@mcp.tool()
def patch_row(table: str, row_id: str, fields: dict[str, Any]) -> str:
    """Patch allowlisted columns only. Status machines and secrets are rejected."""
    return _call(
        lambda: _client.request(
            "PATCH",
            f"/api/admin/tables/{table}/{row_id}",
            json_body={"fields": fields},
        )
    )


@mcp.tool()
def get_overview() -> str:
    """Admin overview counters."""
    return _call(lambda: _client.request("GET", "/api/admin/overview"))


@mcp.tool()
def get_health() -> str:
    """Admin health / pipeline signals."""
    return _call(lambda: _client.request("GET", "/api/admin/health"))


@mcp.tool()
def list_orgs(status: str | None = None) -> str:
    """List orgs, optionally filtered by user status."""
    params = {"status": status} if status else None
    return _call(lambda: _client.request("GET", "/api/admin/orgs", params=params))


@mcp.tool()
def get_org(user_id: str) -> str:
    """Org detail (admin panel)."""
    return _call(lambda: _client.request("GET", f"/api/admin/orgs/{user_id}"))


@mcp.tool()
def approve_org(org_id: str, tester_invite_confirmed: bool = False) -> str:
    """Approve an org (honor-system tester invite confirm)."""
    return _call(
        lambda: _client.request(
            "POST",
            f"/api/admin/orgs/{org_id}/approve",
            json_body={"testerInviteConfirmed": tester_invite_confirmed},
        )
    )


@mcp.tool()
def deny_org(org_id: str) -> str:
    return _call(lambda: _client.request("POST", f"/api/admin/orgs/{org_id}/deny"))


@mcp.tool()
def undeny_org(org_id: str) -> str:
    return _call(lambda: _client.request("POST", f"/api/admin/orgs/{org_id}/undeny"))


@mcp.tool()
def resend_org_connect(org_id: str) -> str:
    return _call(lambda: _client.request("POST", f"/api/admin/orgs/{org_id}/resend-connect"))


@mcp.tool()
def clear_org_instagram_token(user_id: str) -> str:
    return _call(
        lambda: _client.request("POST", f"/api/admin/orgs/{user_id}/clear-instagram-token")
    )


@mcp.tool()
def erase_org(user_id: str, confirm: str) -> str:
    """Erase an org. confirm must be the Instagram handle (PRODUCT §3.1.2)."""
    return _call(
        lambda: _client.request(
            "POST",
            f"/api/admin/orgs/{user_id}/erase",
            json_body={"confirm": confirm},
        )
    )


@mcp.tool()
def compose_org_email(user_id: str, subject: str, body: str) -> str:
    return _call(
        lambda: _client.request(
            "POST",
            f"/api/admin/orgs/{user_id}/send-email",
            json_body={"subject": subject, "body": body},
        )
    )


@mcp.tool()
def list_brands(status: str | None = None) -> str:
    params = {"status": status} if status else None
    return _call(lambda: _client.request("GET", "/api/admin/brands", params=params))


@mcp.tool()
def get_brand(brand_id: str) -> str:
    return _call(lambda: _client.request("GET", f"/api/admin/brands/{brand_id}"))


@mcp.tool()
def create_brand(
    brand_name: str,
    company_email: str,
    instagram_handle: str | None = None,
    intent_message: str | None = None,
    approve_now: bool = False,
) -> str:
    return _call(
        lambda: _client.request(
            "POST",
            "/api/admin/brands",
            json_body={
                "brandName": brand_name,
                "companyEmail": company_email,
                "instagramHandle": instagram_handle,
                "intentMessage": intent_message,
                "approveNow": approve_now,
            },
        )
    )


@mcp.tool()
def approve_brand(brand_id: str) -> str:
    return _call(lambda: _client.request("POST", f"/api/admin/brands/{brand_id}/approve"))


@mcp.tool()
def deny_brand(brand_id: str) -> str:
    return _call(lambda: _client.request("POST", f"/api/admin/brands/{brand_id}/deny"))


@mcp.tool()
def undeny_brand(brand_id: str) -> str:
    return _call(lambda: _client.request("POST", f"/api/admin/brands/{brand_id}/undeny"))


@mcp.tool()
def resend_brand_invite(brand_id: str) -> str:
    return _call(lambda: _client.request("POST", f"/api/admin/brands/{brand_id}/resend-invite"))


@mcp.tool()
def compose_brand_email(brand_id: str, subject: str, body: str) -> str:
    return _call(
        lambda: _client.request(
            "POST",
            f"/api/admin/brands/{brand_id}/send-email",
            json_body={"subject": subject, "body": body},
        )
    )


@mcp.tool()
def list_drops(
    published: str | None = None,
    hidden: bool = False,
) -> str:
    """List drops. published is 'draft' or 'published'."""
    params: dict[str, Any] = {"hidden": hidden}
    if published:
        params["published"] = published
    return _call(lambda: _client.request("GET", "/api/admin/drops", params=params))


@mcp.tool()
def get_drop(drop_id: str) -> str:
    return _call(lambda: _client.request("GET", f"/api/admin/drops/{drop_id}"))


@mcp.tool()
def create_drop(brand_id: str, payload: dict[str, Any]) -> str:
    """Mint an unpublished draft. payload matches AdminDropCreateRequest (camelCase)."""
    return _call(
        lambda: _client.request("POST", f"/api/admin/brands/{brand_id}/drops", json_body=payload)
    )


@mcp.tool()
def publish_drop(drop_id: str) -> str:
    return _call(lambda: _client.request("POST", f"/api/admin/drops/{drop_id}/publish"))


@mcp.tool()
def hide_drop(drop_id: str, confirm: str, notify_brand: bool = False) -> str:
    """Hide a published drop. confirm must be 'hide'."""
    return _call(
        lambda: _client.request(
            "POST",
            f"/api/admin/drops/{drop_id}/hide",
            json_body={"confirm": confirm, "notifyBrand": notify_brand},
        )
    )


@mcp.tool()
def unhide_drop(drop_id: str) -> str:
    return _call(lambda: _client.request("POST", f"/api/admin/drops/{drop_id}/unhide"))


@mcp.tool()
def update_drop(drop_id: str, fields: dict[str, Any]) -> str:
    """Patch drop config (same fields as the admin editor)."""
    return _call(
        lambda: _client.request("PATCH", f"/api/admin/drops/{drop_id}", json_body=fields)
    )


@mcp.tool()
def advance_tracker(drop_id: str, stage: str, note: str | None = None) -> str:
    return _call(
        lambda: _client.request(
            "PATCH",
            f"/api/admin/drops/{drop_id}/tracker",
            json_body={"stage": stage, "note": note},
        )
    )


@mcp.tool()
def reopen_drop(drop_id: str) -> str:
    return _call(lambda: _client.request("POST", f"/api/admin/drops/{drop_id}/reopen"))


@mcp.tool()
def clear_reopen(drop_id: str) -> str:
    return _call(lambda: _client.request("POST", f"/api/admin/drops/{drop_id}/clear-reopen"))


@mcp.tool()
def add_shipment(application_id: str, tracking_number: str, carrier: str | None = None) -> str:
    body: dict[str, Any] = {"trackingNumber": tracking_number}
    if carrier:
        body["carrier"] = carrier
    return _call(
        lambda: _client.request(
            "POST",
            f"/api/admin/applications/{application_id}/shipments",
            json_body=body,
        )
    )


@mcp.tool()
def delete_shipment(application_id: str, shipment_id: str) -> str:
    return _call(
        lambda: _client.request(
            "DELETE",
            f"/api/admin/applications/{application_id}/shipments/{shipment_id}",
        )
    )


@mcp.tool()
def list_drop_requests(status: str | None = None, brand_id: str | None = None) -> str:
    params: dict[str, Any] = {}
    if status:
        params["status"] = status
    if brand_id:
        params["brandId"] = brand_id
    return _call(
        lambda: _client.request(
            "GET", "/api/admin/drop-requests", params=params or None
        )
    )


def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
