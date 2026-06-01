"""Domain enums rendered as PostgreSQL native ENUM types.

Every column that uses one of these enums maps to a real PG type (e.g.
``portal_role``) via ``sqlalchemy.Enum(EnumCls, name="portal_role")``. That
gives us DB-side validation (a stray ``"foo"`` is rejected at insert) and a
single audit trail when values change — adding a new value is a one-line
``ALTER TYPE ... ADD VALUE`` migration.

Naming conventions
------------------
* Enum **class** uses PascalCase; the matching PG **type name** uses the
  same snake_case as the column it serves (``portal_role``,
  ``application_decision``). Keep these in sync so ``\\dT+`` output matches
  the architecture spec verbatim.
* Member ``value`` is the wire/DB string. The Python member name mirrors it
  (uppercased only when the value itself is uppercase) so model code can
  use either ``PortalRole.ORG`` or ``"org"`` interchangeably.

See ``architecture.md`` §3.2 for the canonical list.
"""

from __future__ import annotations

from enum import StrEnum

import sqlalchemy as sa


class PortalRole(StrEnum):
    """Which portal a user belongs to (``users.portal_role``)."""

    ORG = "org"
    BRAND = "brand"
    ADMIN = "admin"


class OrgUserStatus(StrEnum):
    """Lifecycle for org users (``users.status`` when ``portal_role='org'``).

    Mirrors the state machine in architecture §3.3. The same column also
    stores brand-side statuses (``pending_review`` / ``approved`` / ``denied``
    via :class:`BrandStatus`) and the admin states ``active`` / ``suspended``;
    members listed here are the org-flow set per stages-2-plan §2.2.1.
    """

    PENDING_ORG_PROFILE = "pending_org_profile"
    PENDING_EMAIL_VERIFICATION = "pending_email_verification"
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    DENIED = "denied"
    SUSPENDED = "suspended"


class BrandStatus(StrEnum):
    """Lifecycle for brand records (``brands.status``)."""

    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    DENIED = "denied"


class ApplicationDecision(StrEnum):
    """Brand decision on a drop application (``drop_applications.decision``)."""

    APPLIED = "applied"
    ACCEPTED = "accepted"
    DENIED = "denied"


class BrandTrackerStage(StrEnum):
    """Fulfillment tracker stages for a drop (``drops.brand_tracker_stage``,
    ``drop_tracker_events.stage``). Order matters — UIs sort on enum order."""

    AWAITING_BRIEF = "awaiting_brief"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    ACTIVE = "active"
    FINISHED = "finished"


class Platform(StrEnum):
    """Source social platform for a ``social_posts`` row."""

    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"


class SocialMediaType(StrEnum):
    """Instagram Graph API media type (``social_posts.media_type``).

    Values are uppercase to match the API verbatim so we can round-trip
    payloads without translation.
    """

    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    CAROUSEL_ALBUM = "CAROUSEL_ALBUM"


class SocialMediaProductType(StrEnum):
    """Instagram product surface (``social_posts.media_product_type``)."""

    FEED = "FEED"
    REELS = "REELS"
    STORY = "STORY"
    AD = "AD"


class PostLinkSource(StrEnum):
    """Provenance of a ``post_campaign_links`` row.

    ``org_manual`` — student org clicked "Link to campaign".
    ``auto_suggested`` — auto-link suggestion accepted (§10.4).
    """

    ORG_MANUAL = "org_manual"
    AUTO_SUGGESTED = "auto_suggested"


class SuggestionMatchReason(StrEnum):
    """Why the auto-link scan flagged a (post, application) pair (§10.4)."""

    BRAND_HANDLE_CAPTION = "brand_handle_caption"
    CAMPAIGN_HASHTAG = "campaign_hashtag"
    BOTH = "both"


class WaitlistEntityType(StrEnum):
    """Kind of submitter for a public waitlist entry (``waitlist.entity_type``)."""

    BRAND = "brand"
    ORG = "org"


# --- Reusable SQLAlchemy `sa.Enum` instances ---------------------------------
#
# Declared once at module level so the same Python object is referenced by
# every ``mapped_column`` that uses the type. That dedupes the ``CREATE TYPE``
# emitted by Alembic — critical for enums used in more than one table
# (e.g. ``brand_tracker_stage`` lives on both ``drops`` and
# ``drop_tracker_events``). All are native PG enums (``native_enum=True``).
#
# ``values_callable=_enum_values`` tells SQLAlchemy to persist the StrEnum
# ``.value`` (lowercase ``"org"``) rather than the Python member name
# (``"ORG"``). Without it the DB stores names and the architecture spec
# values (e.g. ``portal_role IN ('org','brand','admin')``) silently break.


def _enum_values(enum_cls: type[StrEnum]) -> list[str]:
    return [member.value for member in enum_cls]


PortalRoleEnum = sa.Enum(
    PortalRole, name="portal_role", native_enum=True, values_callable=_enum_values
)
OrgUserStatusEnum = sa.Enum(
    OrgUserStatus, name="org_user_status", native_enum=True, values_callable=_enum_values
)
BrandStatusEnum = sa.Enum(
    BrandStatus, name="brand_status", native_enum=True, values_callable=_enum_values
)
ApplicationDecisionEnum = sa.Enum(
    ApplicationDecision,
    name="application_decision",
    native_enum=True,
    values_callable=_enum_values,
)
BrandTrackerStageEnum = sa.Enum(
    BrandTrackerStage,
    name="brand_tracker_stage",
    native_enum=True,
    values_callable=_enum_values,
)
PlatformEnum = sa.Enum(Platform, name="platform", native_enum=True, values_callable=_enum_values)
SocialMediaTypeEnum = sa.Enum(
    SocialMediaType,
    name="social_media_type",
    native_enum=True,
    values_callable=_enum_values,
)
SocialMediaProductTypeEnum = sa.Enum(
    SocialMediaProductType,
    name="social_media_product_type",
    native_enum=True,
    values_callable=_enum_values,
)
PostLinkSourceEnum = sa.Enum(
    PostLinkSource, name="post_link_source", native_enum=True, values_callable=_enum_values
)
SuggestionMatchReasonEnum = sa.Enum(
    SuggestionMatchReason,
    name="suggestion_match_reason",
    native_enum=True,
    values_callable=_enum_values,
)
WaitlistEntityTypeEnum = sa.Enum(
    WaitlistEntityType,
    name="waitlist_entity_type",
    native_enum=True,
    values_callable=_enum_values,
)


ALL_ENUM_TYPES: tuple[sa.Enum, ...] = (
    PortalRoleEnum,
    OrgUserStatusEnum,
    BrandStatusEnum,
    ApplicationDecisionEnum,
    BrandTrackerStageEnum,
    PlatformEnum,
    SocialMediaTypeEnum,
    SocialMediaProductTypeEnum,
    PostLinkSourceEnum,
    SuggestionMatchReasonEnum,
    WaitlistEntityTypeEnum,
)
"""Ordered tuple of every native ENUM type, used by the initial migration's
``downgrade()`` to drop the corresponding PG types after the tables are gone.
SQLAlchemy creates these implicitly when a table that references them is
created, but it does **not** issue ``DROP TYPE`` on table drop — that has to
be explicit (see ``migrations/versions/<ts>_initial_schema.py``)."""
