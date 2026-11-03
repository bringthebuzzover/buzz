"""Org shipping address requests and admin review workflow."""

from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.constants import ADDRESS_CHANGE_REASON_MAX_LENGTH, ADDRESS_CHANGE_REASON_MIN_LENGTH
from app.exceptions import BuzzAPIException
from app.models.application import DropApplication
from app.models.drop import Drop
from app.models.enums import OrgUserStatus, PortalRole
from app.models.org_shipping_change_request import OrgShippingChangeRequest
from app.models.organization import Organization
from app.models.user import User
from app.services.address import AddressClient, StructuredAddress, addresses_match, apply_to_org
from app.services.lifecycle import drop_running, seat_is_live
from app.timeutils import utcnow

_STATUSES = frozenset({"pending", "approved", "denied"})


def _address_snapshot(org: Organization) -> dict[str, Any] | None:
    if org.shipping_line1 and org.shipping_city and org.shipping_state and org.shipping_postal_code:
        return {
            "shippingLine1": org.shipping_line1,
            "shippingLine2": org.shipping_line2,
            "shippingCity": org.shipping_city,
            "shippingState": org.shipping_state,
            "shippingPostalCode": org.shipping_postal_code,
            "formatted": org.delivery_address,
        }
    if org.delivery_address and org.delivery_address.strip():
        # Keep legacy formatted-only destinations as a review baseline.
        return {"formatted": org.delivery_address}
    return None


def _serialize(row: OrgShippingChangeRequest) -> dict[str, Any]:
    return {
        "id": row.id,
        "org_id": row.org_id,
        "requester_user_id": row.requester_user_id,
        "reviewer_user_id": row.reviewer_user_id,
        "current_address": row.current_address,
        "requested_address": row.requested_address,
        "base_address_version": row.base_address_version,
        "reason": row.reason,
        "status": row.status,
        "decision_reason": row.decision_reason,
        "created_at": row.created_at,
        "decided_at": row.decided_at,
    }


def _address_dict(address: StructuredAddress) -> dict[str, Any]:
    return {
        "shippingLine1": address.line1,
        "shippingLine2": address.line2,
        "shippingCity": address.city,
        "shippingState": address.state,
        "shippingPostalCode": address.postal_code,
        "formatted": address.formatted,
    }


def _to_structured(value: dict[str, Any]) -> dict[str, str | None]:
    return {
        "line1": str(value.get("shippingLine1") or ""),
        "line2": value.get("shippingLine2"),
        "city": str(value.get("shippingCity") or ""),
        "state": str(value.get("shippingState") or ""),
        "postal_code": str(value.get("shippingPostalCode") or ""),
    }


async def _lock_org(db: AsyncSession, org_id: UUID) -> Organization:
    org = await db.scalar(
        select(Organization)
        .where(Organization.id == org_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if org is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)
    return org


async def get_my_state(db: AsyncSession, user: User) -> dict[str, Any]:
    org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
    if org is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization profile not found.", status_code=404)
    rows = list(
        await db.scalars(
            select(OrgShippingChangeRequest)
            .where(OrgShippingChangeRequest.org_id == org.id)
            .order_by(
                OrgShippingChangeRequest.created_at.desc(), OrgShippingChangeRequest.id.desc()
            )
            .limit(1)
        )
    )
    latest = rows[0] if rows else None
    pending = latest if latest is not None and latest.status == "pending" else None
    return {
        "pending": _serialize(pending) if pending else None,
        "latest": _serialize(latest) if latest else None,
    }


async def submit_request(
    db: AsyncSession,
    user: User,
    *,
    shipping_line1: str,
    shipping_line2: str | None,
    shipping_city: str,
    shipping_state: str,
    shipping_postal_code: str,
    shipping_place_id: str | None,
    reason: str,
    addresses: AddressClient,
) -> dict[str, Any]:
    if user.portal_role != PortalRole.ORG.value or user.status != OrgUserStatus.ACTIVE.value:
        raise BuzzAPIException(
            errors.FORBIDDEN, "Active organization access is required.", status_code=403
        )
    org = await db.scalar(select(Organization).where(Organization.user_id == user.id))
    if org is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization profile not found.", status_code=404)
    org = await _lock_org(db, org.id)
    baseline = _address_snapshot(org)
    if baseline is None:
        raise BuzzAPIException(
            errors.ADDRESS_CHANGE_REVIEW_REQUIRED,
            "Add an initial shipping address in your profile before requesting a change.",
            status_code=409,
        )
    pending = await db.scalar(
        select(OrgShippingChangeRequest.id).where(
            OrgShippingChangeRequest.org_id == org.id,
            OrgShippingChangeRequest.status == "pending",
        )
    )
    if pending is not None:
        raise BuzzAPIException(
            errors.ADDRESS_CHANGE_PENDING,
            "Your organization already has a pending shipping address request.",
            status_code=409,
        )
    cleaned_reason = reason.strip()
    if (
        not ADDRESS_CHANGE_REASON_MIN_LENGTH
        <= len(cleaned_reason)
        <= ADDRESS_CHANGE_REASON_MAX_LENGTH
    ):
        raise BuzzAPIException(
            errors.VALIDATION_ERROR, "Reason length is outside the allowed range.", status_code=400
        )
    validated = await addresses.validate(
        line1=shipping_line1,
        line2=shipping_line2,
        city=shipping_city,
        state=shipping_state,
        postal_code=shipping_postal_code,
        place_id=shipping_place_id,
    )
    requested = _address_dict(validated)
    if addresses_match(baseline, requested):
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "The requested address matches the current address.",
            status_code=400,
        )
    row = OrgShippingChangeRequest(
        id=uuid4(),
        org_id=org.id,
        requester_user_id=user.id,
        current_address=baseline,
        requested_address=requested,
        base_address_version=org.shipping_address_version,
        reason=cleaned_reason,
        status="pending",
    )
    db.add(row)
    await db.flush()
    return _serialize(row)


async def _admin_context(db: AsyncSession, row: OrgShippingChangeRequest) -> dict[str, Any]:
    org, user = (
        await db.execute(
            select(Organization, User)
            .join(User, User.id == Organization.user_id)
            .where(Organization.id == row.org_id)
        )
    ).one()
    titles = list(
        await db.scalars(
            select(Drop.title)
            .join(DropApplication, DropApplication.drop_id == Drop.id)
            .where(
                DropApplication.org_id == org.id,
                seat_is_live(),
                *drop_running(),
            )
            .order_by(Drop.title, Drop.id)
        )
    )
    return {
        "org_name": org.org_name,
        "university": org.university,
        "edu_email": user.edu_email,
        "active_drop_titles": titles,
    }


async def list_requests(db: AsyncSession, *, status: str | None = None) -> list[dict[str, Any]]:
    if status is not None and status not in _STATUSES:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR, f"Unknown request status: {status}.", status_code=400
        )
    stmt = select(OrgShippingChangeRequest).order_by(
        OrgShippingChangeRequest.created_at.asc(), OrgShippingChangeRequest.id.asc()
    )
    if status:
        stmt = stmt.where(OrgShippingChangeRequest.status == status)
    output = []
    for row in (await db.scalars(stmt)).all():
        output.append({**_serialize(row), **(await _admin_context(db, row))})
    return output


async def get_request(db: AsyncSession, request_id: UUID) -> dict[str, Any]:
    row = await db.get(OrgShippingChangeRequest, request_id)
    if row is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Shipping request not found.", status_code=404)
    return {**_serialize(row), **(await _admin_context(db, row))}


async def _locked_request(db: AsyncSession, request_id: UUID) -> OrgShippingChangeRequest:
    row = await db.scalar(
        select(OrgShippingChangeRequest)
        .where(OrgShippingChangeRequest.id == request_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if row is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Shipping request not found.", status_code=404)
    return row


async def approve_request(
    db: AsyncSession,
    request_id: UUID,
    reviewer: User,
    *,
    addresses: AddressClient,
) -> dict[str, Any]:
    # Lock order is org → request. Shipment creation uses drop → org → shipment.
    initial = await db.get(OrgShippingChangeRequest, request_id)
    if initial is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Shipping request not found.", status_code=404)
    org = await _lock_org(db, initial.org_id)
    row = await _locked_request(db, request_id)
    if row.status != "pending" or row.redacted_at is not None:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "This request has already been decided.",
            status_code=409,
        )
    user = await db.get(User, row.requester_user_id)
    if user is None or user.status == OrgUserStatus.ERASED.value:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "Erased organizations cannot receive address changes.",
            status_code=409,
        )
    if row.base_address_version != org.shipping_address_version:
        raise BuzzAPIException(
            errors.ADDRESS_CHANGE_STALE,
            "The current shipping address changed after this request was submitted.",
            status_code=409,
        )
    raw = _to_structured(row.requested_address or {})
    validated = await addresses.validate(
        line1=raw["line1"] or "",
        line2=raw["line2"],
        city=raw["city"] or "",
        state=raw["state"] or "",
        postal_code=raw["postal_code"] or "",
    )
    apply_to_org(org, validated)
    row.status = "approved"
    row.reviewer_user_id = reviewer.id
    row.decided_at = utcnow()
    await db.flush()
    return {**_serialize(row), **(await _admin_context(db, row))}


async def deny_request(
    db: AsyncSession,
    request_id: UUID,
    reviewer: User,
    *,
    decision_reason: str | None = None,
) -> dict[str, Any]:
    initial = await db.get(OrgShippingChangeRequest, request_id)
    if initial is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Shipping request not found.", status_code=404)
    await _lock_org(db, initial.org_id)
    row = await _locked_request(db, request_id)
    if row.status != "pending" or row.redacted_at is not None:
        raise BuzzAPIException(
            errors.INVALID_ONBOARDING_STATE,
            "This request has already been decided.",
            status_code=409,
        )
    reason = (decision_reason or "").strip() or None
    if reason and len(reason) > ADDRESS_CHANGE_REASON_MAX_LENGTH:
        raise BuzzAPIException(
            errors.VALIDATION_ERROR, "Decision reason is too long.", status_code=400
        )
    row.status = "denied"
    row.reviewer_user_id = reviewer.id
    row.decision_reason = reason
    row.decided_at = utcnow()
    await db.flush()
    return {**_serialize(row), **(await _admin_context(db, row))}
