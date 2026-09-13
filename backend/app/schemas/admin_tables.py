"""Admin table-inspect schemas (MCP / ops). Wire is camelCase + epoch-ms rows."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from app.schemas.common import CamelModel


class AdminTableColumn(CamelModel):
    name: str
    hidden: bool
    writable: bool


class AdminTableInfo(CamelModel):
    name: str
    writable: bool
    columns: list[AdminTableColumn]
    filterable: list[str]


class AdminTableQueryRequest(CamelModel):
    filters: dict[str, Any] = Field(default_factory=dict)
    limit: int = Field(default=25, ge=1, le=50)
    offset: int = Field(default=0, ge=0)


class AdminTableQueryResponse(CamelModel):
    table: str
    rows: list[dict[str, Any]]
    limit: int
    offset: int


class AdminTableRowResponse(CamelModel):
    table: str
    row: dict[str, Any]


class AdminTablePatchRequest(CamelModel):
    fields: dict[str, Any]
