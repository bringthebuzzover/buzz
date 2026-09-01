"""Read-only admin queries: the overview counters, account/drop detail, and the
health signals. Every function here is a SELECT; mutations live in
:mod:`app.services.admin`.

Pipeline signals still watch for the *absence* of a job's effect (e.g. a drop
past its apply window still in ``request_received``). When ``job_runs`` rows
exist, each pipeline signal's ``detail`` also includes the last recorded run
age so ops can tell whether the cron fired recently.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import errors
from app.exceptions import BuzzAPIException
from app.jobs.metric_sync import METRIC_WINDOW_DAYS
from app.jobs.names import (
    JOB_DROP_AUTOCLOSE,
    JOB_METRIC_SYNC,
    JOB_TOKEN_CLEANUP,
    JOB_TOKEN_REFRESH,
)
from app.jobs.token_cleanup import DEFAULT_GRACE_DAYS
from app.models.application import DropApplication
from app.models.brand import Brand
from app.models.brand_invite_token import BrandInviteToken
from app.models.drop import Drop
from app.models.enums import (
    ApplicationDecision,
    BrandStatus,
    BrandTrackerStage,
    OrgUserStatus,
    PortalRole,
    SocialMediaProductType,
)
from app.models.job_run import JobRun
from app.models.notify_me import NotifyMe
from app.models.organization import Organization
from app.models.post_link import PostCampaignLink
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.social_post import SocialPost
from app.models.tracker_event import DropTrackerEvent
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.security.token_crypto import TokenDecryptionError, decrypt_token
from app.services.instagram_token import REFRESH_WINDOW_DAYS

# ``metric_sync`` runs daily at 03:00 UTC; 36h leaves room for one missed run
# plus clock skew before we call it stale.
_METRIC_SYNC_STALE_HOURS = 36

_ATTENTION_FILTERS = frozenset(
    {
        "awaiting_finalization",
        "ready_to_advance",
        "autoclose_overdue",
        "reopened_stuck",
        "no_tracking",
    }
)

# Signals worth interrupting an admin for on the overview. Ordered most to least
# urgent; the page renders only the non-zero ones.
_OVERVIEW_WARNING_KEYS = (
    "brand_invite_never_redeemed",
    "verification_blocked_by_ig",
    "drop_reopened_stuck",
    "awaiting_products_no_tracking",
    "stranded_applicants",
    "denied_brand_orphan_user",
    "accepted_over_capacity",
    "units_over_budget",
    "accepted_missing_units",
    "active_user_without_profile",
    "notify_me_never_sent",
)

_INTEGRITY_KEYS = (
    "accepted_over_capacity",
    "units_over_budget",
    "accepted_missing_units",
    "stranded_applicants",
    "active_user_without_profile",
    "denied_brand_orphan_user",
    "brand_invite_never_redeemed",
    "verification_blocked_by_ig",
    "drop_reopened_stuck",
    "awaiting_products_no_tracking",
)

_SILENT_KEYS = (
    "notify_me_never_sent",
    "posts_never_refreshed",
    "posts_missing_insights",
    "pending_suggestions",
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _scalar_int(db: AsyncSession, stmt: Select[Any]) -> int:
    return int(await db.scalar(stmt) or 0)


async def _count_and_oldest(db: AsyncSession, stmt: Select[Any]) -> dict[str, Any]:
    """Run a ``select(count(), min(...))`` and shape it for a queue card."""
    count, oldest = (await db.execute(stmt)).one()
    return {"count": int(count or 0), "oldest_at": oldest}


# ── Signal counts ───────────────────────────────────────────────────────────


async def _signal_counts(db: AsyncSession, now: datetime) -> dict[str, int]:
    """Every count-based signal, keyed by signal name.

    Single source of truth for these definitions. See ``gaps/`` for why
    each one is reachable in the first place.
    """

    accepted = ApplicationDecision.ACCEPTED.value
    applied = ApplicationDecision.APPLIED.value

    # Drops whose accepted count exceeds capacity. Capacity is only checked per
    # finalize call, so a reopen + second round can blow past it.
    over_capacity_sq = (
        select(Drop.id)
        .join(
            DropApplication,
            and_(DropApplication.drop_id == Drop.id, DropApplication.decision == accepted),
        )
        .group_by(Drop.id, Drop.capacity_total)
        .having(func.count(DropApplication.id) > Drop.capacity_total)
        .subquery()
    )
    over_budget_sq = (
        select(Drop.id)
        .join(
            DropApplication,
            and_(DropApplication.drop_id == Drop.id, DropApplication.decision == accepted),
        )
        .where(Drop.total_product_units.is_not(None))
        .group_by(Drop.id, Drop.total_product_units)
        .having(
            func.coalesce(func.sum(DropApplication.allocated_units), 0) > Drop.total_product_units
        )
        .subquery()
    )

    metric_cutoff = now - timedelta(days=METRIC_WINDOW_DAYS)
    cleanup_cutoff = now - timedelta(days=DEFAULT_GRACE_DAYS)
    stale_before = now - timedelta(hours=_METRIC_SYNC_STALE_HOURS)

    return {
        # --- Unrecoverable / stuck ---
        "brand_invite_never_redeemed": await _scalar_int(
            db,
            select(func.count(Brand.id))
            .join(User, User.id == Brand.user_id)
            .where(Brand.status == BrandStatus.APPROVED.value, User.password_hash.is_(None)),
        ),
        "denied_brand_orphan_user": await _scalar_int(
            db,
            select(func.count(Brand.id))
            .join(User, User.id == Brand.user_id)
            .where(
                Brand.status == BrandStatus.DENIED.value,
                User.status != OrgUserStatus.DENIED.value,
            ),
        ),
        "drop_reopened_stuck": await _scalar_int(
            db,
            select(func.count(Drop.id)).where(
                Drop.manual_reopen.is_(True),
                Drop.brand_tracker_stage == BrandTrackerStage.REQUEST_RECEIVED.value,
            ),
        ),
        "awaiting_products_no_tracking": await _scalar_int(
            db,
            select(func.count(Drop.id)).where(
                Drop.brand_tracker_stage == BrandTrackerStage.AWAITING_PRODUCTS.value,
                Drop.tracking_number.is_(None),
            ),
        ),
        "verification_blocked_by_ig": await _scalar_int(
            db,
            select(func.count(User.id)).where(
                User.status == OrgUserStatus.PENDING_EMAIL_VERIFICATION.value,
                User.instagram_token_expires_at.is_not(None),
                User.instagram_token_expires_at <= now,
            ),
        ),
        "stranded_applicants": await _scalar_int(
            db,
            select(func.count(DropApplication.id))
            .join(Drop, Drop.id == DropApplication.drop_id)
            .where(
                DropApplication.decision == applied,
                Drop.applicant_selection_finalized_at.is_not(None),
            ),
        ),
        # --- Broken invariants ---
        "accepted_over_capacity": await _scalar_int(
            db, select(func.count()).select_from(over_capacity_sq)
        ),
        "units_over_budget": await _scalar_int(
            db, select(func.count()).select_from(over_budget_sq)
        ),
        "accepted_missing_units": await _scalar_int(
            db,
            select(func.count(DropApplication.id))
            .join(Drop, Drop.id == DropApplication.drop_id)
            .where(
                DropApplication.decision == accepted,
                Drop.total_product_units.is_not(None),
                or_(
                    DropApplication.allocated_units.is_(None),
                    DropApplication.allocated_units == 0,
                ),
            ),
        ),
        "active_user_without_profile": await _scalar_int(
            db,
            select(func.count(User.id))
            .outerjoin(Organization, Organization.user_id == User.id)
            .outerjoin(Brand, Brand.user_id == User.id)
            .where(
                User.status == OrgUserStatus.ACTIVE.value,
                or_(
                    and_(
                        User.portal_role == PortalRole.ORG.value,
                        Organization.id.is_(None),
                    ),
                    and_(User.portal_role == PortalRole.BRAND.value, Brand.id.is_(None)),
                ),
            ),
        ),
        # --- Silent data loss ---
        "notify_me_never_sent": await _scalar_int(
            db,
            select(func.count(NotifyMe.id))
            .join(Drop, Drop.id == NotifyMe.drop_id)
            .where(
                NotifyMe.enabled.is_(True),
                NotifyMe.sent_at.is_(None),
                Drop.apply_open_at <= now,
                # Closed windows are historical misses the job will never mail;
                # counting them forever makes the signal permanently red.
                Drop.apply_close_at > now,
            ),
        ),
        "posts_never_refreshed": await _scalar_int(
            db,
            select(func.count(SocialPost.id)).where(
                SocialPost.metrics_updated_at.is_(None),
                # Stories are never refreshed (unsupported); do not count as sync debt.
                SocialPost.media_product_type != SocialMediaProductType.STORY.value,
            ),
        ),
        "posts_missing_insights": await _scalar_int(
            db,
            select(func.count(SocialPost.id)).where(
                SocialPost.metrics_updated_at.is_not(None),
                SocialPost.reach.is_(None),
                SocialPost.views.is_(None),
                SocialPost.total_interactions.is_(None),
            ),
        ),
        "pending_suggestions": await _scalar_int(
            db,
            select(func.count(PostCampaignSuggestion.id)).where(
                PostCampaignSuggestion.confirmed_at.is_(None),
                PostCampaignSuggestion.dismissed_at.is_(None),
            ),
        ),
        # --- Inferred pipeline health ---
        "autoclose_overdue": await _scalar_int(
            db,
            select(func.count(Drop.id)).where(
                Drop.brand_tracker_stage == BrandTrackerStage.REQUEST_RECEIVED.value,
                Drop.manual_reopen.is_(False),
                Drop.apply_close_at < now,
            ),
        ),
        "metric_sync_stale": await _scalar_int(
            db,
            select(func.count(SocialPost.id)).where(
                SocialPost.posted_at >= metric_cutoff,
                SocialPost.media_product_type != SocialMediaProductType.STORY.value,
                or_(
                    SocialPost.metrics_updated_at.is_(None),
                    SocialPost.metrics_updated_at < stale_before,
                ),
            ),
        ),
        "token_cleanup_backlog": (
            await _scalar_int(
                db,
                select(func.count(EmailVerificationToken.id)).where(
                    or_(
                        EmailVerificationToken.used_at < cleanup_cutoff,
                        EmailVerificationToken.expires_at < cleanup_cutoff,
                    )
                ),
            )
            + await _scalar_int(
                db,
                select(func.count(BrandInviteToken.id)).where(
                    or_(
                        BrandInviteToken.used_at < cleanup_cutoff,
                        BrandInviteToken.expires_at < cleanup_cutoff,
                    )
                ),
            )
        ),
        # ``refresh_due_tokens`` rotates anything still-valid and <14 days out,
        # including the last day. Anything already expired (or past) means the
        # org needs reconnect — cron cannot help.
        "token_refresh_overdue": await _scalar_int(
            db,
            select(func.count(User.id)).where(
                User.portal_role == PortalRole.ORG.value,
                User.status != OrgUserStatus.ERASED.value,
                User.instagram_access_token.is_not(None),
                User.instagram_token_expires_at.is_not(None),
                User.instagram_token_expires_at <= now,
            ),
        ),
    }


# ── Overview ────────────────────────────────────────────────────────────────


async def get_overview(db: AsyncSession) -> dict[str, Any]:
    """Action-required queue counts plus the non-zero warning signals.

    Each queue carries the timestamp of its oldest item, not just a count — a
    queue of three that has been sitting for nine days is a different problem
    from three that arrived this morning.
    """

    now = _now()
    finalizing = BrandTrackerStage.FINALIZING_AGREEMENTS.value

    orgs_pending = await _count_and_oldest(
        db,
        select(func.count(User.id), func.min(User.created_at)).where(
            User.portal_role == PortalRole.ORG.value,
            User.status == OrgUserStatus.PENDING_APPROVAL.value,
        ),
    )
    brands_pending = await _count_and_oldest(
        db,
        select(func.count(Brand.id), func.min(Brand.created_at)).where(
            Brand.status == BrandStatus.PENDING_REVIEW.value
        ),
    )
    # Waiting on the *brand* to pick applicants. Ages from apply_close_at, which
    # is when the ball entered their court.
    awaiting_finalization = await _count_and_oldest(
        db,
        select(func.count(Drop.id), func.min(Drop.apply_close_at)).where(
            Drop.brand_tracker_stage == finalizing,
            Drop.applicant_selection_finalized_at.is_(None),
            Drop.apply_close_at < now,
        ),
    )
    # Selection is done and the tracker is behind drop_active, so an admin can
    # move it forward.
    ready_to_advance = await _count_and_oldest(
        db,
        select(func.count(Drop.id), func.min(Drop.applicant_selection_finalized_at)).where(
            Drop.applicant_selection_finalized_at.is_not(None),
            Drop.brand_tracker_stage.in_([finalizing, BrandTrackerStage.AWAITING_PRODUCTS.value]),
        ),
    )

    counts = await _signal_counts(db, now)
    return {
        "generated_at": now,
        "queues": [
            {"key": "orgs_pending_approval", **orgs_pending},
            {"key": "brands_pending_review", **brands_pending},
            {"key": "drops_awaiting_finalization", **awaiting_finalization},
            {"key": "drops_ready_to_advance", **ready_to_advance},
        ],
        "warnings": [
            {"key": key, "count": counts[key]} for key in _OVERVIEW_WARNING_KEYS if counts[key] > 0
        ],
    }


# ── Health ──────────────────────────────────────────────────────────────────


def _signal(
    key: str, count: int, *, ok: bool | None = None, detail: str | None = None
) -> dict[str, Any]:
    """Uniform signal shape so the frontend renders one row component.

    ``ok`` defaults to "nothing to act on", i.e. a zero count.
    """
    return {"key": key, "count": count, "ok": count == 0 if ok is None else ok, "detail": detail}


def _describe_age(value: datetime | None, now: datetime) -> str | None:
    if value is None:
        return None
    delta = now - (value if value.tzinfo else value.replace(tzinfo=timezone.utc))
    hours = delta.total_seconds() / 3600
    if hours < 1:
        return "under an hour ago"
    if hours < 48:
        return f"{int(hours)}h ago"
    return f"{int(hours // 24)}d ago"


async def get_health(db: AsyncSession) -> dict[str, Any]:
    """Inferred pipeline freshness, Instagram token buckets, and standing
    integrity / silent-loss counts."""

    now = _now()
    counts = await _signal_counts(db, now)

    last_runs = {
        row.job: row.last_finished
        for row in (
            await db.execute(
                select(JobRun.job, func.max(JobRun.finished_at).label("last_finished"))
                .where(JobRun.finished_at.is_not(None), JobRun.ok.is_(True))
                .group_by(JobRun.job)
            )
        ).all()
    }

    def _with_run_age(job: str, detail: str) -> str:
        age = _describe_age(last_runs.get(job), now)
        if age:
            return f"{detail}; last run {age}"
        return detail

    last_metric_sync = await db.scalar(select(func.max(SocialPost.metrics_updated_at)))
    metric_detail = _describe_age(last_metric_sync, now)
    pipeline = [
        _signal(
            JOB_DROP_AUTOCLOSE,
            counts["autoclose_overdue"],
            detail=_with_run_age(
                JOB_DROP_AUTOCLOSE,
                "drops past their apply window still awaiting auto-close",
            ),
        ),
        _signal(
            JOB_METRIC_SYNC,
            counts["metric_sync_stale"],
            detail=_with_run_age(
                JOB_METRIC_SYNC,
                (
                    f"last refresh {metric_detail}"
                    if metric_detail
                    else "no post metrics recorded yet"
                ),
            ),
        ),
        _signal(
            JOB_TOKEN_CLEANUP,
            counts["token_cleanup_backlog"],
            detail=_with_run_age(
                JOB_TOKEN_CLEANUP,
                f"expired tokens past the {DEFAULT_GRACE_DAYS}-day sweep grace",
            ),
        ),
        _signal(
            JOB_TOKEN_REFRESH,
            counts["token_refresh_overdue"],
            detail=_with_run_age(
                JOB_TOKEN_REFRESH,
                "Instagram tokens at or past expiry",
            ),
        ),
    ]

    org_only = and_(
        User.portal_role == PortalRole.ORG.value,
        User.status != OrgUserStatus.ERASED.value,
    )
    has_token = and_(
        User.instagram_access_token.is_not(None),
        User.instagram_token_expires_at.is_not(None),
    )
    soon = now + timedelta(days=REFRESH_WINDOW_DAYS)
    missing, expired, _expiring_sql, _healthy_sql = (
        await db.execute(
            select(
                func.count().filter(
                    or_(
                        User.instagram_access_token.is_(None),
                        User.instagram_token_expires_at.is_(None),
                    )
                ),
                func.count().filter(and_(has_token, User.instagram_token_expires_at <= now)),
                func.count().filter(
                    and_(
                        has_token,
                        User.instagram_token_expires_at > now,
                        User.instagram_token_expires_at <= soon,
                    )
                ),
                func.count().filter(and_(has_token, User.instagram_token_expires_at > soon)),
            )
            .select_from(User)
            .where(org_only)
        )
    ).one()

    # Probe ciphertext for not-yet-expired tokens — a rotated
    # TOKEN_ENCRYPTION_KEY leaves future expires_at but dead blobs. Read-only:
    # clearing happens on login / jobs.
    undecryptable = 0
    healthy_adj = 0
    expiring_adj = 0
    probe_users = list(
        await db.scalars(
            select(User).where(
                org_only,
                has_token,
                User.instagram_token_expires_at > now,
            )
        )
    )
    for probe in probe_users:
        assert probe.instagram_access_token is not None
        exp = probe.instagram_token_expires_at
        assert exp is not None
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        try:
            decrypt_token(probe.instagram_access_token)
        except TokenDecryptionError:
            undecryptable += 1
            continue
        if exp <= soon:
            expiring_adj += 1
        else:
            healthy_adj += 1

    return {
        "generated_at": now,
        "pipeline": pipeline,
        "instagram_tokens": [
            # Healthy and expiring-soon are informational: the refresh job is
            # meant to handle the latter, so neither is actionable.
            _signal("healthy", healthy_adj, ok=True),
            _signal("expiring_soon", expiring_adj, ok=True),
            _signal("expired", int(expired or 0)),
            _signal("missing", int(missing or 0)),
            _signal("undecryptable", undecryptable),
        ],
        "integrity": [_signal(key, counts[key]) for key in _INTEGRITY_KEYS],
        "silent": [_signal(key, counts[key]) for key in _SILENT_KEYS],
    }


# ── Account detail ──────────────────────────────────────────────────────────


async def get_org_detail(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    """One org account: user identity, profile, application tally, and the
    verification-token state that explains a stuck onboarding."""

    row = (
        await db.execute(
            select(User, Organization)
            .outerjoin(Organization, Organization.user_id == User.id)
            .where(User.id == user_id, User.portal_role == PortalRole.ORG.value)
        )
    ).first()
    if row is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Organization not found.", status_code=404)
    user, org = row

    decisions: dict[str, int] = {}
    posts = linked_posts = 0
    if org is not None:
        decisions = {
            str(decision): int(count)
            for decision, count in (
                await db.execute(
                    select(DropApplication.decision, func.count(DropApplication.id))
                    .where(DropApplication.org_id == org.id)
                    .group_by(DropApplication.decision)
                )
            ).all()
        }
        posts = await _scalar_int(
            db, select(func.count(SocialPost.id)).where(SocialPost.org_id == org.id)
        )
        linked_posts = await _scalar_int(
            db,
            select(func.count(PostCampaignLink.id))
            .join(SocialPost, SocialPost.id == PostCampaignLink.post_id)
            .where(SocialPost.org_id == org.id),
        )

    now = _now()
    latest_token = (
        await db.scalars(
            select(EmailVerificationToken)
            .where(EmailVerificationToken.user_id == user.id)
            .order_by(EmailVerificationToken.created_at.desc())
            .limit(1)
        )
    ).first()
    live_tokens = await _scalar_int(
        db,
        select(func.count(EmailVerificationToken.id)).where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used_at.is_(None),
            EmailVerificationToken.expires_at > now,
        ),
    )

    return {
        "user_id": user.id,
        "org_id": org.id if org is not None else None,
        "status": user.status,
        "org_name": org.org_name if org is not None else None,
        "university": org.university if org is not None else None,
        "category": org.category if org is not None else None,
        "instagram_handle": user.instagram_username,
        "instagram_handle_confirmed": (
            org.instagram_handle_confirmed if org is not None else False
        ),
        "instagram_username": user.instagram_username,
        "tiktok_handle": org.tiktok_handle if org is not None else None,
        "follower_count": org.follower_count if org is not None else None,
        "member_count": org.member_count if org is not None else None,
        "city": org.city if org is not None else None,
        "state": org.state if org is not None else None,
        "contact_name": org.contact_name if org is not None else None,
        "delivery_address": org.delivery_address if org is not None else None,
        "edu_email": user.edu_email,
        "email_verified_at": user.email_verified_at,
        "approved_at": org.approved_at if org is not None else None,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
        "instagram_token_expires_at": user.instagram_token_expires_at,
        "instagram_token_refreshed_at": user.instagram_token_refreshed_at,
        "impersonatable": user.status == OrgUserStatus.ACTIVE.value,
        "applications": {
            "applied": decisions.get(ApplicationDecision.APPLIED.value, 0),
            "accepted": decisions.get(ApplicationDecision.ACCEPTED.value, 0),
            "denied": decisions.get(ApplicationDecision.DENIED.value, 0),
        },
        "post_count": posts,
        "linked_post_count": linked_posts,
        "verification": {
            "live_token_count": live_tokens,
            "latest_expires_at": latest_token.expires_at if latest_token else None,
            "latest_used_at": latest_token.used_at if latest_token else None,
        },
    }


async def get_brand_detail(db: AsyncSession, brand_id: UUID) -> dict[str, Any]:
    """One brand account: profile, the three-way status split, invite-token
    state, and the drops it owns."""

    row = (
        await db.execute(
            select(Brand, User).join(User, User.id == Brand.user_id).where(Brand.id == brand_id)
        )
    ).first()
    if row is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Brand not found.", status_code=404)
    brand, user = row

    latest_invite = (
        await db.scalars(
            select(BrandInviteToken)
            .where(BrandInviteToken.brand_id == brand.id)
            .order_by(BrandInviteToken.created_at.desc())
            .limit(1)
        )
    ).first()

    drops = await list_drops(db, brand_id=brand.id)

    return {
        "id": brand.id,
        "user_id": brand.user_id,
        "brand_name": brand.brand_name,
        "company_email": brand.company_email,
        "intent_message": brand.intent_message,
        "instagram_handle": brand.instagram_handle,
        "status": brand.status,
        "user_status": user.status,
        "password_set": bool(user.password_hash),
        "approved_at": brand.approved_at,
        "created_at": brand.created_at,
        "last_login_at": user.last_login_at,
        "impersonatable": user.status == OrgUserStatus.ACTIVE.value,
        "invite": {
            "issued_at": latest_invite.created_at if latest_invite else None,
            "expires_at": latest_invite.expires_at if latest_invite else None,
            # Ambiguous by construction: create_brand_invite stamps used_at both
            # on redemption and when superseding a re-issue. The row alone
            # cannot tell them apart, so pair it with password_set.
            "used_at": latest_invite.used_at if latest_invite else None,
        },
        "drops": drops,
    }


# ── Drops ───────────────────────────────────────────────────────────────────


async def list_drops(
    db: AsyncSession,
    *,
    stage: list[str] | None = None,
    attention: list[str] | None = None,
    brand_id: UUID | None = None,
    published: str | None = None,
) -> list[dict[str, Any]]:
    """Drops with their applicant tallies, newest first.

    ``stage`` / ``attention`` accept zero-or-more values (repeated query keys).
    Within a dimension values OR; across dimensions they AND. Empty/omitted
    means no filter on that dimension. Overview badges deep-link with a single
    attention value.

    ``published`` is ``draft`` | ``published`` | None (all).
    """

    stages = list(stage or [])
    attentions = list(attention or [])
    known_stages = {member.value for member in BrandTrackerStage}
    for value in stages:
        if value not in known_stages:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR, f"Unknown tracker stage: {value}.", status_code=400
            )
    for value in attentions:
        if value not in _ATTENTION_FILTERS:
            raise BuzzAPIException(
                errors.VALIDATION_ERROR, f"Unknown attention filter: {value}.", status_code=400
            )
    if published is not None and published not in ("draft", "published"):
        raise BuzzAPIException(
            errors.VALIDATION_ERROR,
            "published must be draft or published.",
            status_code=400,
        )

    applied_sq = (
        select(DropApplication.drop_id, func.count().label("n"))
        .where(DropApplication.decision == ApplicationDecision.APPLIED.value)
        .group_by(DropApplication.drop_id)
        .subquery()
    )
    accepted_sq = (
        select(DropApplication.drop_id, func.count().label("n"))
        .where(DropApplication.decision == ApplicationDecision.ACCEPTED.value)
        .group_by(DropApplication.drop_id)
        .subquery()
    )

    stmt = (
        select(
            Drop,
            Brand.brand_name,
            Brand.status,
            func.coalesce(applied_sq.c.n, 0),
            func.coalesce(accepted_sq.c.n, 0),
        )
        .join(Brand, Brand.id == Drop.brand_id)
        .outerjoin(applied_sq, applied_sq.c.drop_id == Drop.id)
        .outerjoin(accepted_sq, accepted_sq.c.drop_id == Drop.id)
        .order_by(Drop.created_at.desc())
    )
    if stages:
        stmt = stmt.where(Drop.brand_tracker_stage.in_(stages))
    if brand_id is not None:
        stmt = stmt.where(Drop.brand_id == brand_id)
    if published == "draft":
        stmt = stmt.where(Drop.published_at.is_(None))
    elif published == "published":
        stmt = stmt.where(Drop.published_at.isnot(None))
    if attentions:
        now = _now()
        stmt = stmt.where(or_(*[and_(*_attention_clause(a, now)) for a in attentions]))

    return [
        {
            "id": drop.id,
            "brand_id": drop.brand_id,
            "brand_name": brand_name,
            "brand_status": brand_status,
            "title": drop.title,
            "stage": drop.brand_tracker_stage,
            "capacity_total": drop.capacity_total,
            "total_product_units": drop.total_product_units,
            "applied_count": int(applied_count),
            "accepted_count": int(accepted_count),
            "apply_open_at": drop.apply_open_at,
            "apply_close_at": drop.apply_close_at,
            "manual_reopen": drop.manual_reopen,
            "tracking_number": drop.tracking_number,
            "campaign_hashtag": drop.campaign_hashtag,
            "finalized_at": drop.applicant_selection_finalized_at,
            "published_at": drop.published_at,
            "drop_request_id": drop.drop_request_id,
            "created_at": drop.created_at,
        }
        for drop, brand_name, brand_status, applied_count, accepted_count in (
            await db.execute(stmt)
        ).all()
    ]


def _attention_clause(attention: str, now: datetime) -> tuple[Any, ...]:
    finalizing = BrandTrackerStage.FINALIZING_AGREEMENTS.value
    if attention == "awaiting_finalization":
        return (
            Drop.brand_tracker_stage == finalizing,
            Drop.applicant_selection_finalized_at.is_(None),
            Drop.apply_close_at < now,
        )
    if attention == "ready_to_advance":
        return (
            Drop.applicant_selection_finalized_at.is_not(None),
            Drop.brand_tracker_stage.in_([finalizing, BrandTrackerStage.AWAITING_PRODUCTS.value]),
        )
    if attention == "autoclose_overdue":
        return (
            Drop.brand_tracker_stage == BrandTrackerStage.REQUEST_RECEIVED.value,
            Drop.manual_reopen.is_(False),
            Drop.apply_close_at < now,
        )
    if attention == "reopened_stuck":
        return (
            Drop.manual_reopen.is_(True),
            Drop.brand_tracker_stage == BrandTrackerStage.REQUEST_RECEIVED.value,
        )
    # no_tracking
    return (
        Drop.brand_tracker_stage == BrandTrackerStage.AWAITING_PRODUCTS.value,
        Drop.tracking_number.is_(None),
    )


async def get_drop_detail(db: AsyncSession, drop_id: UUID) -> dict[str, Any]:
    """One drop with its applicants and full tracker history."""

    row = (
        await db.execute(
            select(Drop, Brand).join(Brand, Brand.id == Drop.brand_id).where(Drop.id == drop_id)
        )
    ).first()
    if row is None:
        raise BuzzAPIException(errors.NOT_FOUND, "Drop not found.", status_code=404)
    drop, brand = row

    links_sq = (
        select(PostCampaignLink.application_id, func.count().label("n"))
        .join(DropApplication, DropApplication.id == PostCampaignLink.application_id)
        .where(DropApplication.drop_id == drop.id)
        .group_by(PostCampaignLink.application_id)
        .subquery()
    )
    applicants = [
        {
            "id": application.id,
            "org_id": org.id,
            "user_id": org.user_id,
            "org_name": org.org_name,
            "university": org.university,
            "instagram_handle": org_user.instagram_username,
            "follower_count": org.follower_count,
            "delivery_address": org.delivery_address,
            "account_erased": org_user.status == OrgUserStatus.ERASED.value,
            "decision": application.decision,
            "allocated_units": application.allocated_units,
            "pitch": application.pitch,
            "tracking_number": drop.tracking_number,
            "linked_post_count": int(linked or 0),
            "applied_at": application.applied_at,
            "decision_at": application.decision_at,
        }
        for application, org, org_user, linked in (
            await db.execute(
                select(DropApplication, Organization, User, func.coalesce(links_sq.c.n, 0))
                .join(Organization, Organization.id == DropApplication.org_id)
                .join(User, User.id == Organization.user_id)
                .outerjoin(links_sq, links_sq.c.application_id == DropApplication.id)
                .where(DropApplication.drop_id == drop.id)
                .order_by(DropApplication.applied_at.asc())
            )
        ).all()
    ]

    events = [
        {"id": event.id, "stage": event.stage, "note": event.note, "occurred_at": event.occurred_at}
        for event in (
            await db.scalars(
                select(DropTrackerEvent)
                .where(DropTrackerEvent.drop_id == drop.id)
                .order_by(DropTrackerEvent.occurred_at.asc())
            )
        ).all()
    ]

    linked_posts = await _scalar_int(
        db,
        select(func.count(PostCampaignLink.id))
        .join(DropApplication, DropApplication.id == PostCampaignLink.application_id)
        .where(DropApplication.drop_id == drop.id),
    )
    pending_suggestions = await _scalar_int(
        db,
        select(func.count(PostCampaignSuggestion.id))
        .join(DropApplication, DropApplication.id == PostCampaignSuggestion.application_id)
        .where(
            DropApplication.drop_id == drop.id,
            PostCampaignSuggestion.confirmed_at.is_(None),
            PostCampaignSuggestion.dismissed_at.is_(None),
        ),
    )
    allocated = await _scalar_int(
        db,
        select(func.coalesce(func.sum(DropApplication.allocated_units), 0)).where(
            DropApplication.drop_id == drop.id,
            DropApplication.decision == ApplicationDecision.ACCEPTED.value,
        ),
    )

    return {
        "id": drop.id,
        "brand_id": brand.id,
        "brand_name": brand.brand_name,
        "brand_status": brand.status,
        "brand_instagram_handle": brand.instagram_handle,
        "title": drop.title,
        "description": drop.description,
        "image": drop.image,
        "location": drop.location,
        "stage": drop.brand_tracker_stage,
        "capacity_total": drop.capacity_total,
        "total_product_units": drop.total_product_units,
        "allocated_units": allocated,
        "campaign_hashtag": drop.campaign_hashtag,
        "brand_can_edit_creative": drop.brand_can_edit_creative,
        "tracking_number": drop.tracking_number,
        "manual_reopen": drop.manual_reopen,
        "apply_open_at": drop.apply_open_at,
        "apply_close_at": drop.apply_close_at,
        "finalized_at": drop.applicant_selection_finalized_at,
        "published_at": drop.published_at,
        "drop_request_id": drop.drop_request_id,
        "created_at": drop.created_at,
        "linked_post_count": linked_posts,
        "pending_suggestion_count": pending_suggestions,
        "applicants": applicants,
        "tracker_events": events,
    }
