/**
 * Presentation for the admin panel's keyed payloads.
 *
 * The API returns bare keys and counts (`{ key: "notify_me_never_sent", count: 4 }`)
 * and this module owns the copy and the deep links. Keeping labels client-side
 * means rewording a warning is a frontend-only change, and the backend never has
 * to know what admin routes exist.
 */

import { BRAND_DROP_TRACKER_ORDER } from "../../types/brandPortal";

export type QueueMeta = {
  label: string;
  /** What the admin is actually waiting on, in one line. */
  note: string;
  /** Where the count's rows live. */
  to: string;
  /** Whose court the ball is in — an admin can only clear the "us" ones. */
  owner: "us" | "brand";
};

export const QUEUE_META: Record<string, QueueMeta> = {
  orgs_pending_approval: {
    label: "Orgs awaiting approval",
    note: "Verified their email and are waiting on a decision",
    to: "/admin/orgs?status=pending_approval",
    owner: "us",
  },
  brands_pending_review: {
    label: "Brands awaiting review",
    note: "Applied for a brand account and are waiting on a decision",
    to: "/admin/brands?status=pending_review",
    owner: "us",
  },
  drops_awaiting_finalization: {
    label: "Drops awaiting selection",
    note: "Apply window closed; the brand has not picked applicants yet",
    to: "/admin/drops?attention=awaiting_finalization",
    owner: "brand",
  },
  drops_ready_to_advance: {
    label: "Drops ready to advance",
    note: "Selection is finalized; the tracker can move forward",
    to: "/admin/drops?attention=ready_to_advance",
    owner: "us",
  },
};

export type SignalMeta = {
  label: string;
  note: string;
  /** Optional deep link to the affected rows, where one exists. */
  to?: string;
};

/**
 * Every warning and health signal. The notes explain *why* a state is reachable,
 * because a count with no explanation is not actionable — see `gaps/` for
 * the long form and the detection queries.
 */
export const SIGNAL_META: Record<string, SignalMeta> = {
  // Stuck with no recovery path in the API.
  brand_invite_never_redeemed: {
    label: "Brands that never set a password",
    note: "Approved, but the invite lapsed. Re-inviting needs a new admin action, so these accounts are stuck.",
    to: "/admin/brands?status=approved",
  },
  denied_brand_orphan_user: {
    label: "Denied brands with a live user row",
    note: "Denying a brand does not update its user, which stays at pending_approval forever.",
    to: "/admin/brands?status=denied",
  },
  drop_reopened_stuck: {
    label: "Reopened drops that cannot auto-close",
    note: "Auto-close skips manually reopened drops and the flag is never reset, so the tracker must be moved by hand.",
    to: "/admin/drops?attention=reopened_stuck",
  },
  awaiting_products_no_tracking: {
    label: "Shipping stage with no tracking number",
    note: "Tracking is only writable on the transition into this stage, and the tracker is forward-only.",
    to: "/admin/drops?attention=no_tracking",
  },
  verification_blocked_by_ig: {
    label: "Orgs locked out of email verification",
    note: "An expired Instagram token rejects every request, including the one that would resend their verification email. Org self-serve reconnect is /reconnect-instagram (Instagram OAuth); Clear IG token is optional ops assist.",
    to: "/admin/orgs?status=pending_email_verification",
  },
  stranded_applicants: {
    label: "Applicants on a finalized drop",
    note: "Selection closed without deciding them. Only a reopen can rescue these.",
  },
  // Invariants with no database constraint behind them.
  accepted_over_capacity: {
    label: "Drops accepted past capacity",
    note: "Capacity is checked per selection round, not cumulatively, so a reopen can exceed it.",
  },
  units_over_budget: {
    label: "Drops allocated past their unit budget",
    note: "Same per-round check as capacity.",
  },
  accepted_missing_units: {
    label: "Accepted orgs with no units",
    note: "The drop has a unit budget but these rows were allocated zero or null.",
  },
  active_user_without_profile: {
    label: "Active users with no profile",
    note: "Every portal request for these accounts fails with a server error.",
  },
  // Writes that silently go nowhere.
  notify_me_never_sent: {
    label: "Drop reminders never delivered",
    note: "An open drop's reminder window passed but the job never mailed these subscribers — usually a missing .edu address or a cron that stopped running.",
  },
  posts_never_refreshed: {
    label: "Posts with no metrics",
    note: "FEED/REELS discovered by the sync job but never successfully refreshed. Instagram Stories are unsupported and excluded.",
  },
  posts_missing_insights: {
    label: "Posts missing insight metrics",
    note: "Likes and comments came through but reach, views, and interactions did not — usually a missing Instagram scope.",
  },
  pending_suggestions: {
    label: "Unconfirmed auto-link suggestions",
    note: "Attributed metrics understate reality until the org confirms these.",
  },
};

/** Pipeline signals name a cron job, so they carry its schedule instead. */
export const PIPELINE_META: Record<
  string,
  { label: string; schedule: string; inference: string }
> = {
  drop_autoclose: {
    label: "Drop auto-close",
    schedule: "every 5 minutes",
    inference: "Counts drops whose apply window closed but never advanced.",
  },
  metric_sync: {
    label: "Metric sync",
    schedule: "daily 03:00 UTC",
    inference:
      "Counts recent FEED/REELS whose metrics are missing or over 36h old. Stories are unsupported and excluded.",
  },
  token_cleanup: {
    label: "Token cleanup",
    schedule: "daily 03:00 UTC",
    inference: "Counts expired tokens still present past the 7-day grace.",
  },
  token_refresh: {
    label: "Instagram token refresh",
    schedule: "daily 04:00 UTC",
    inference:
      "Only still-valid tokens near expiry are selected. Already-expired rows belong in the expired bucket — org must OAuth reconnect (/reconnect-instagram); cron cannot resurrect them.",
  },
};

export const TOKEN_BUCKET_META: Record<string, SignalMeta> = {
  healthy: { label: "Healthy", note: "More than 30 days of life left" },
  expiring_soon: {
    label: "Expiring soon",
    note: "Inside 30 days — the refresh job's normal workload",
  },
  expired: {
    label: "Expired",
    note: "Authenticated org requests return INSTAGRAM_TOKEN_EXPIRED until the org reconnects via Instagram OAuth; token_refresh will not retry already-expired tokens",
  },
  missing: {
    label: "Missing",
    note: "Revoked via Meta or never connected; no post data will arrive",
  },
  undecryptable: {
    label: "Undecryptable",
    note: "Ciphertext cannot be read (e.g. encryption key rotated); org must reconnect",
  },
};

export const STAGE_LABELS: Record<string, string> = {
  request_received: "Request received",
  finalizing_agreements: "Finalizing agreements",
  awaiting_products: "Awaiting products",
  drop_active: "Drop active",
  drop_finished: "Drop finished",
};

/** Same order as brand portal — single stage-order SOT. */
export const STAGE_ORDER = BRAND_DROP_TRACKER_ORDER;

export const STATUS_LABELS: Record<string, string> = {
  pending_org_profile: "No profile yet",
  pending_email_verification: "Unverified email",
  pending_approval: "Awaiting approval",
  pending_review: "Awaiting review",
  active: "Active",
  approved: "Approved",
  denied: "Denied",
};

export function humanizeKey(key: string): string {
  return key.replace(/_/g, " ");
}

/** "3 days", "4h", "12m" — the elapsed side of a timestamp. */
export function formatElapsed(epochMs: number | null): string {
  if (epochMs === null) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - epochMs) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)} days`;
}

export function formatDate(epochMs: number | null): string {
  if (epochMs === null) return "—";
  return new Date(epochMs).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(epochMs: number | null): string {
  if (epochMs === null) return "—";
  return new Date(epochMs).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
