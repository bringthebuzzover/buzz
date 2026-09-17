"""Allowlisted admin table inspect + patch (ideas/admin-mcp.md).

Every ORM table is visible. Secrets never leave the service. Status machines
and Graph-owned facts are read-only here — named admin actions still own them.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic.alias_generators import to_camel
from sqlalchemy import func, select
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.brand import Brand
from app.models.brand_invite_token import BrandInviteToken
from app.models.drop import Drop
from app.models.drop_apply_intent import DropApplyIntent
from app.models.drop_request import DropRequest
from app.models.enums import OrgCategory
from app.models.job_run import JobRun
from app.models.notify_me import NotifyMe
from app.models.org_apply_prefill import OrgApplyPrefill
from app.models.org_connect_token import OrgConnectToken
from app.models.org_ig_change_request import OrgIgChangeRequest
from app.models.organization import Organization
from app.models.password_reset_token import PasswordResetToken
from app.models.post_link import PostCampaignLink
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.shipment import CARRIERS, DropApplicationShipment
from app.models.social_post import SocialPost
from app.models.tracker_event import DropTrackerEvent
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.schemas.admin import AdminDropConfigPatch
from app.schemas.common import camelize
from app.services.address import AddressClient, apply_to_org, format_us_address, get_address_client
from app.services.admin import update_drop_config
from app.services.instagram import canonical_instagram_handle

_CAMEL_RE = re.compile(r"([a-z0-9])([A-Z])")
_NOTIFY_MINUTES = frozenset({5, 15, 60})
_SHIPPING_KEYS = (
    "shipping_line1",
    "shipping_line2",
    "shipping_city",
    "shipping_state",
    "shipping_postal_code",
)
_DROP_PATCH_KEYS = frozenset(
    {
        "capacity_total",
        "apply_open_at",
        "apply_close_at",
        "total_product_units",
        "campaign_hashtag",
        "brand_can_edit_creative",
        "title",
        "description",
        "image",
        "location",
    }
)


@dataclass(frozen=True)
class TableSpec:
    model: type[Any]
    hidden: frozenset[str]
    patchable: frozenset[str]
    filterable: frozenset[str]
    kind: Literal["columns", "drop_config"] = "columns"


TABLES: dict[str, TableSpec] = {
    "users": TableSpec(
        User,
        hidden=frozenset(
            {
                "password_hash",
                "instagram_access_token",
                "instagram_user_id",
                "instagram_token_user_id",
                "token_version",
            }
        ),
        patchable=frozenset({"edu_email", "instagram_username"}),
        filterable=frozenset({"id", "portal_role", "status", "edu_email", "instagram_username"}),
    ),
    "organizations": TableSpec(
        Organization,
        hidden=frozenset(),
        patchable=frozenset(
            {
                "org_name",
                "university",
                "tiktok_handle",
                "member_count",
                "category",
                "contact_name",
                "city",
                "state",
                *_SHIPPING_KEYS,
            }
        ),
        filterable=frozenset({"id", "user_id", "org_name", "university", "category"}),
    ),
    "brands": TableSpec(
        Brand,
        hidden=frozenset(),
        patchable=frozenset({"brand_name", "company_email", "instagram_handle", "intent_message"}),
        filterable=frozenset({"id", "user_id", "status", "company_email", "brand_name"}),
    ),
    "drops": TableSpec(
        Drop,
        hidden=frozenset(),
        patchable=_DROP_PATCH_KEYS,
        filterable=frozenset({"id", "brand_id", "brand_tracker_stage", "drop_request_id", "title"}),
        kind="drop_config",
    ),
    "drop_requests": TableSpec(
        DropRequest,
        hidden=frozenset(),
        patchable=frozenset({"message", "notes"}),
        filterable=frozenset({"id", "brand_id", "status", "converted_drop_id"}),
    ),
    "drop_applications": TableSpec(
        DropApplication,
        hidden=frozenset(),
        patchable=frozenset({"pitch", "allocated_units"}),
        filterable=frozenset({"id", "drop_id", "org_id", "decision"}),
    ),
    "drop_apply_intents": TableSpec(
        DropApplyIntent,
        hidden=frozenset(),
        patchable=frozenset(),
        filterable=frozenset({"id", "org_id", "drop_id", "status"}),
    ),
    "drop_application_shipments": TableSpec(
        DropApplicationShipment,
        hidden=frozenset(),
        patchable=frozenset({"tracking_number", "carrier"}),
        filterable=frozenset({"id", "application_id", "carrier"}),
    ),
    "social_posts": TableSpec(
        SocialPost,
        hidden=frozenset(),
        patchable=frozenset(),
        filterable=frozenset({"id", "org_id", "platform", "external_id"}),
    ),
    "post_campaign_links": TableSpec(
        PostCampaignLink,
        hidden=frozenset(),
        patchable=frozenset(),
        filterable=frozenset({"id", "post_id", "application_id"}),
    ),
    "post_campaign_suggestions": TableSpec(
        PostCampaignSuggestion,
        hidden=frozenset(),
        patchable=frozenset(),
        filterable=frozenset({"id", "post_id", "application_id", "match_reason"}),
    ),
    "notify_me": TableSpec(
        NotifyMe,
        hidden=frozenset(),
        patchable=frozenset({"reminder_minutes", "enabled"}),
        filterable=frozenset({"id", "org_id", "drop_id", "enabled"}),
    ),
    "drop_tracker_events": TableSpec(
        DropTrackerEvent,
        hidden=frozenset(),
        patchable=frozenset(),
        filterable=frozenset({"id", "drop_id", "stage"}),
    ),
    "job_runs": TableSpec(
        JobRun,
        hidden=frozenset(),
        patchable=frozenset(),
        filterable=frozenset({"id", "job", "ok"}),
    ),
    "email_verification_tokens": TableSpec(
        EmailVerificationToken,
        hidden=frozenset({"token_hash"}),
        patchable=frozenset(),
        filterable=frozenset({"id", "user_id", "email"}),
    ),
    "brand_invite_tokens": TableSpec(
        BrandInviteToken,
        hidden=frozenset({"token_hash"}),
        patchable=frozenset(),
        filterable=frozenset({"id", "user_id", "brand_id", "email"}),
    ),
    "password_reset_tokens": TableSpec(
        PasswordResetToken,
        hidden=frozenset({"token_hash"}),
        patchable=frozenset(),
        filterable=frozenset({"id", "user_id", "email"}),
    ),
    "org_connect_tokens": TableSpec(
        OrgConnectToken,
        hidden=frozenset({"token_hash"}),
        patchable=frozenset(),
        filterable=frozenset({"id", "user_id", "org_id", "email"}),
    ),
    "org_ig_change_requests": TableSpec(
        OrgIgChangeRequest,
        hidden=frozenset(),
        patchable=frozenset(),
        filterable=frozenset({"id", "org_id", "user_id", "status", "kind"}),
    ),
    "org_apply_prefills": TableSpec(
        OrgApplyPrefill,
        hidden=frozenset({"token_hash"}),
        patchable=frozenset(
            {
                "invite_email",
                "org_name",
                "university",
                "edu_email",
                "instagram_handle",
                "member_count",
                "category",
                "contact_name",
                *_SHIPPING_KEYS,
                "shipping_raw",
                "extras",
                "source",
                "source_row_key",
            }
        ),
        filterable=frozenset({"id", "invite_email", "edu_email", "source"}),
    ),
}


def _snake(name: str) -> str:
    if "_" in name:
        return name
    return _CAMEL_RE.sub(r"\1_\2", name).lower()


def _normalize_fields(fields: dict[str, Any]) -> dict[str, Any]:
    return {_snake(key): value for key, value in fields.items()}


def _column_names(spec: TableSpec) -> list[str]:
    return [column.key for column in sa_inspect(spec.model).columns]


def _cell(value: Any) -> Any:
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        aware = value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
        return int(aware.timestamp() * 1000)
    return value


def _row_dict(spec: TableSpec, row: Any) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for name in _column_names(spec):
        if name in spec.hidden:
            continue
        out[name] = _cell(getattr(row, name))
    camel = camelize(out)
    if not isinstance(camel, dict):
        raise TypeError("row camelize must return a dict")
    return camel


def _spec(table: str) -> TableSpec:
    spec = TABLES.get(table)
    if spec is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Unknown table.", status_code=404)
    return spec


def list_table_catalog() -> list[dict[str, Any]]:
    catalog: list[dict[str, Any]] = []
    for name, spec in TABLES.items():
        columns = [
            {
                "name": to_camel(col),
                "hidden": col in spec.hidden,
                "writable": col in spec.patchable,
            }
            for col in _column_names(spec)
        ]
        catalog.append(
            {
                "name": name,
                "writable": bool(spec.patchable),
                "columns": columns,
                "filterable": sorted(to_camel(key) for key in spec.filterable),
            }
        )
    return catalog


def _coerce_filter(model: type[Any], key: str, value: Any) -> Any:
    column = sa_inspect(model).columns[key]
    python_type = getattr(column.type, "python_type", None)
    if python_type is uuid.UUID:
        try:
            return uuid.UUID(str(value))
        except ValueError as exc:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR,
                f"Invalid UUID for {key}.",
                status_code=400,
            ) from exc
    if python_type is bool and not isinstance(value, bool):
        if value in ("true", "1", True):
            return True
        if value in ("false", "0", False):
            return False
        raise BuzzAPIException(
            errors.VALIDATION_ERROR, f"Invalid boolean for {key}.", status_code=400
        )
    if python_type is int and not isinstance(value, bool):
        try:
            return int(value)
        except (TypeError, ValueError) as exc:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR, f"Invalid integer for {key}.", status_code=400
            ) from exc
    return value


async def query_table(
    db: AsyncSession,
    table: str,
    *,
    filters: dict[str, Any] | None = None,
    limit: int = 25,
    offset: int = 0,
) -> dict[str, Any]:
    spec = _spec(table)
    normalized = _normalize_fields(filters or {})
    stmt = select(spec.model)
    for key, value in normalized.items():
        if key not in spec.filterable or key in spec.hidden:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR,
                f"Cannot filter {table} by {key}.",
                status_code=400,
            )
        column = getattr(spec.model, key)
        stmt = stmt.where(column == _coerce_filter(spec.model, key, value))
    if hasattr(spec.model, "created_at"):
        stmt = stmt.order_by(spec.model.created_at.desc())
    else:
        stmt = stmt.order_by(spec.model.id)
    result = await db.scalars(stmt.limit(limit).offset(offset))
    return {
        "table": table,
        "rows": [_row_dict(spec, row) for row in result.all()],
        "limit": limit,
        "offset": offset,
    }


async def get_table_row(db: AsyncSession, table: str, row_id: uuid.UUID) -> dict[str, Any]:
    spec = _spec(table)
    row = await db.get(spec.model, row_id)
    if row is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Row not found.", status_code=404)
    return {"table": table, "row": _row_dict(spec, row)}


async def patch_table_row(
    db: AsyncSession,
    table: str,
    row_id: uuid.UUID,
    fields: dict[str, Any],
    addresses: AddressClient | None = None,
) -> dict[str, Any]:
    spec = _spec(table)
    updates = _normalize_fields(fields)
    if not updates:
        raise BuzzAPIException(errors.VALIDATION_ERROR, "No fields to patch.", status_code=400)
    unknown = [key for key in updates if key not in spec.patchable]
    if unknown:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            f"Cannot patch {table} columns: {', '.join(sorted(unknown))}.",
            status_code=400,
        )

    if spec.kind == "drop_config":
        await update_drop_config(db, row_id, AdminDropConfigPatch.model_validate(updates))
        return await get_table_row(db, table, row_id)

    row = await db.get(spec.model, row_id)
    if row is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Row not found.", status_code=404)

    if table == "users":
        await _patch_user(db, row, updates)
    elif table == "organizations":
        await _patch_org(row, updates, addresses or get_address_client())
    elif table == "brands":
        await _patch_brand(db, row, updates)
    elif table == "drop_applications":
        _patch_application(row, updates)
    elif table == "drop_application_shipments":
        await _patch_shipment(db, row, updates)
    elif table == "notify_me":
        _patch_notify(row, updates)
    elif table == "org_apply_prefills":
        _patch_prefill(row, updates)
    else:
        for key, value in updates.items():
            setattr(row, key, value)

    await db.flush()
    return await get_table_row(db, table, row_id)


async def _patch_user(db: AsyncSession, user: User, updates: dict[str, Any]) -> None:
    if "edu_email" in updates:
        email = (updates["edu_email"] or "").strip().lower() or None
        if email is not None:
            taken = await db.scalar(
                select(User.id).where(func.lower(User.edu_email) == email, User.id != user.id)
            )
            if taken is not None:
                raise BuzzAPIException(
                    errors.EDU_EMAIL_TAKEN, "That .edu email is already in use.", status_code=409
                )
        user.edu_email = email
    if "instagram_username" in updates:
        handle = canonical_instagram_handle(updates["instagram_username"]) or None
        if handle is not None:
            taken = await db.scalar(
                select(User.id).where(
                    func.lower(User.instagram_username) == handle.lower(),
                    User.id != user.id,
                )
            )
            if taken is not None:
                raise BuzzAPIException(
                    errors.INSTAGRAM_HANDLE_TAKEN,
                    "That Instagram handle is already claimed.",
                    status_code=409,
                )
        user.instagram_username = handle


async def _patch_org(org: Organization, updates: dict[str, Any], addresses: AddressClient) -> None:
    shipping = {key: updates.pop(key) for key in list(updates) if key in _SHIPPING_KEYS}
    if "category" in updates:
        _set_category(org, updates.pop("category"))
    if "member_count" in updates:
        org.member_count = _nonneg_int(updates.pop("member_count"), "member_count")
    if "tiktok_handle" in updates:
        raw = updates.pop("tiktok_handle")
        org.tiktok_handle = canonical_instagram_handle(raw) or None if raw else None
    for key, value in updates.items():
        if isinstance(value, str):
            value = value.strip() or None
        setattr(org, key, value)
    if shipping:
        await _apply_shipping(org, shipping, addresses)


async def _apply_shipping(
    org: Organization, shipping: dict[str, Any], addresses: AddressClient
) -> None:
    line1 = shipping.get("shipping_line1", org.shipping_line1)
    line2 = shipping.get("shipping_line2", org.shipping_line2)
    city = shipping.get("shipping_city", org.shipping_city)
    state = shipping.get("shipping_state", org.shipping_state)
    postal = shipping.get("shipping_postal_code", org.shipping_postal_code)
    if not line1 or not city or not state or not postal:
        raise BuzzAPIException(
            errors.INVALID_SHIPPING_ADDRESS,
            "Shipping patch needs line1, city, state, and postal code.",
            status_code=400,
        )
    addr = await addresses.validate(
        line1=str(line1),
        line2=None if line2 is None else str(line2),
        city=str(city),
        state=str(state),
        postal_code=str(postal),
    )
    apply_to_org(org, addr)


async def _patch_brand(db: AsyncSession, brand: Brand, updates: dict[str, Any]) -> None:
    if "company_email" in updates:
        email = (updates.pop("company_email") or "").strip().lower()
        if "@" not in email:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR, "company_email must be an email.", status_code=400
            )
        taken = await db.scalar(
            select(Brand.id).where(func.lower(Brand.company_email) == email, Brand.id != brand.id)
        )
        if taken is not None:
            raise BuzzAPIException(
                errors.BRAND_EMAIL_TAKEN, "That company email is already in use.", status_code=409
            )
        brand.company_email = email
    if "instagram_handle" in updates:
        raw = updates.pop("instagram_handle")
        brand.instagram_handle = canonical_instagram_handle(raw) or None if raw else None
    for key, value in updates.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(brand, key, value)


def _patch_application(row: DropApplication, updates: dict[str, Any]) -> None:
    if "allocated_units" in updates:
        raw = updates.pop("allocated_units")
        row.allocated_units = None if raw is None else _nonneg_int(raw, "allocated_units")
    if "pitch" in updates:
        pitch = updates.pop("pitch")
        row.pitch = None if pitch is None else str(pitch)


async def _patch_shipment(
    db: AsyncSession, row: DropApplicationShipment, updates: dict[str, Any]
) -> None:
    if "carrier" in updates:
        carrier = str(updates.pop("carrier") or "").strip().lower()
        if carrier not in CARRIERS:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR,
                f"carrier must be one of: {', '.join(CARRIERS)}.",
                status_code=400,
            )
        row.carrier = carrier
    if "tracking_number" in updates:
        tn = str(updates.pop("tracking_number") or "").strip()
        if not tn:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR, "tracking_number is required.", status_code=400
            )
        taken = await db.scalar(
            select(DropApplicationShipment.id).where(
                DropApplicationShipment.application_id == row.application_id,
                DropApplicationShipment.tracking_number == tn,
                DropApplicationShipment.id != row.id,
            )
        )
        if taken is not None:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR,
                "That tracking number is already on this organization.",
                status_code=409,
            )
        row.tracking_number = tn


def _patch_notify(row: NotifyMe, updates: dict[str, Any]) -> None:
    if "reminder_minutes" in updates:
        raw = updates.pop("reminder_minutes")
        try:
            minutes = int(raw)
        except (TypeError, ValueError) as exc:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR,
                "reminder_minutes must be 5, 15, or 60.",
                status_code=400,
            ) from exc
        if minutes not in _NOTIFY_MINUTES:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR,
                "reminder_minutes must be 5, 15, or 60.",
                status_code=400,
            )
        row.reminder_minutes = minutes
    if "enabled" in updates:
        row.enabled = bool(updates.pop("enabled"))


def _patch_prefill(row: OrgApplyPrefill, updates: dict[str, Any]) -> None:
    shipping = {key: updates.pop(key) for key in list(updates) if key in _SHIPPING_KEYS}
    if "category" in updates:
        _set_category(row, updates.pop("category"))
    if "instagram_handle" in updates:
        raw = updates.pop("instagram_handle")
        row.instagram_handle = canonical_instagram_handle(raw) or None if raw else None
    if "invite_email" in updates or "edu_email" in updates:
        for key in ("invite_email", "edu_email"):
            if key in updates:
                value = updates.pop(key)
                setattr(row, key, (str(value).strip().lower() or None) if value else None)
    for key, value in updates.items():
        setattr(row, key, value)
    if shipping:
        line1 = shipping.get("shipping_line1", row.shipping_line1)
        line2 = shipping.get("shipping_line2", row.shipping_line2)
        city = shipping.get("shipping_city", row.shipping_city)
        state = shipping.get("shipping_state", row.shipping_state)
        postal = shipping.get("shipping_postal_code", row.shipping_postal_code)
        row.shipping_line1 = None if line1 is None else str(line1).strip()
        row.shipping_line2 = None if line2 is None else str(line2).strip() or None
        row.shipping_city = None if city is None else str(city).strip()
        row.shipping_state = None if state is None else str(state).strip().upper()
        row.shipping_postal_code = None if postal is None else str(postal).strip()
        if (
            row.shipping_line1
            and row.shipping_city
            and row.shipping_state
            and row.shipping_postal_code
        ):
            row.shipping_raw = format_us_address(
                row.shipping_line1,
                row.shipping_line2,
                row.shipping_city,
                row.shipping_state,
                row.shipping_postal_code,
            )


def _set_category(row: Any, value: Any) -> None:
    if value is None or value == "":
        row.category = None
        return
    raw = str(value).strip().lower()
    try:
        row.category = OrgCategory(raw).value
    except ValueError as exc:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            f"category must be one of: {', '.join(c.value for c in OrgCategory)}.",
            status_code=400,
        ) from exc


def _nonneg_int(value: Any, name: str) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR, f"{name} must be an integer.", status_code=400
        ) from exc
    if parsed < 0:
        raise BuzzAPIException(errors.VALIDATION_ERROR, f"{name} must be >= 0.", status_code=400)
    return parsed
