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

See buzz-ops ``engineering/architecture.md`` §3.2 for the canonical list.
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
    via :class:`BrandStatus`) and the admin state ``active``; members listed
    here are the org-flow set per stages-2-plan §2.2.1. (``suspended`` was
    never written by product code and has been removed.)
    """

    PENDING_ORG_PROFILE = "pending_org_profile"
    PENDING_EMAIL_VERIFICATION = "pending_email_verification"
    PENDING_APPROVAL = "pending_approval"
    PENDING_INSTAGRAM = "pending_instagram"
    ACTIVE = "active"
    DENIED = "denied"
    ERASED = "erased"


class BrandStatus(StrEnum):
    """Lifecycle for brand records (``brands.status``)."""

    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    DENIED = "denied"
    ERASED = "erased"


class OrgCategory(StrEnum):
    """Classification of a student org (``organizations.category``).

    Drives brand-side applicant filtering (buzz-ops product/PRODUCT.md §5.3.1). Nullable on the
    column — orgs onboarded before this field, or that decline to classify,
    have no category.
    """

    SORORITY = "sorority"
    FRATERNITY = "fraternity"
    SPORTS = "sports"
    ACADEMIC = "academic"
    SOCIAL = "social"
    OTHER = "other"


class ApplicationDecision(StrEnum):
    """Seat status (``drop_applications.decision``).

    ``applied`` = undecided; ``accepted`` / ``denied`` are drafts until sent.
    ``withdrew`` (the org pulled out) and ``removed`` (BUZZ, with a reason)
    end a seat softly: the row, its shipments and its posts stay for history.
    """

    APPLIED = "applied"
    ACCEPTED = "accepted"
    DENIED = "denied"
    WITHDREW = "withdrew"
    REMOVED = "removed"


class DropStage(StrEnum):
    """Computed drop stage (``app.services.lifecycle``; never stored).

    ``draft`` → ``upcoming`` → ``applying`` → ``selecting`` → ``live`` →
    ``wrapped``, or ``canceled`` from any published stage before wrap-up.
    Only draft (unpublished), wrapped (``wrapped_at``) and canceled
    (``canceled_at``) come from a BUZZ click; the rest follow from the apply
    dates and the seats.
    Hidden is a separate flag (``drops.hidden_at``), not a stage.
    """

    DRAFT = "draft"
    UPCOMING = "upcoming"
    APPLYING = "applying"
    SELECTING = "selecting"
    LIVE = "live"
    WRAPPED = "wrapped"
    CANCELED = "canceled"


class SeatProgress(StrEnum):
    """Where a live seat has got to: the furthest fact reached, never a gate.

    Computed (``app.services.lifecycle.seat_progress``), never stored. Only
    accepted seats whose decision went out have progress.
    """

    ACCEPTED = "accepted"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    POSTED = "posted"


class BrandTrackerStage(StrEnum):
    """Legacy tracker stages (``drops.brand_tracker_stage``, now nullable and
    unwritten). Nothing reads them except the legacy ``request_received`` stub
    cleanup; the column goes away with them. ``DropStage`` replaces them."""

    REQUEST_RECEIVED = "request_received"
    FINALIZING_AGREEMENTS = "finalizing_agreements"
    AWAITING_PRODUCTS = "awaiting_products"
    DROP_ACTIVE = "drop_active"
    DROP_FINISHED = "drop_finished"


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


class DropApplyIntentStatus(StrEnum):
    """Lifecycle for ``drop_apply_intents.status`` (PRODUCT §6.3.4 / §7.1)."""

    OPEN = "open"
    EXPIRED = "expired"
    PROMOTED = "promoted"


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
OrgCategoryEnum = sa.Enum(
    OrgCategory, name="org_category", native_enum=True, values_callable=_enum_values
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
DropApplyIntentStatusEnum = sa.Enum(
    DropApplyIntentStatus,
    name="drop_apply_intent_status",
    native_enum=True,
    values_callable=_enum_values,
)
