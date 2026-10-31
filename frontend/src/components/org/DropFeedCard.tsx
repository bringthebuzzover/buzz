/**
 * Org-side drop feed card. Renders status-aware copy and a primary CTA per
 * `DropFeedStatus` (Upcoming / Open / Closed). Per buzz-ops product/PRODUCT.md §6.3 and §7.2 there
 * is no waitlist; capacity-Closed (every spot accepted) shows
 * Closed on the feed for new applies — not mid-window fill during first Open.
 *
 * - Upcoming: countdown to `applyOpenAt` + Notify Me toggle.
 * - Open: Apply; spots copy is "Up to N" when no prior accepts, else "M of N remaining".
 * - Closed: disabled action with reason chip.
 * - Accepted on this drop: the card opens the campaign in My Campaigns (PRODUCT §6.3).
 *
 * Pen `Drop / Tile`: a 420px media well (status badge and spots on top, brand
 * and title over the scrim), then description, location, and the CTA pill.
 *
 * The card is presentational; data fetching + mutations are wired by the parent
 * (`OrgDropFeedPage`) and the inline apply form.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import type { DropCardData, DropFeedStatus } from "../../types/drop";
import { useCountdown } from "../../utils/useCountdown";
import type { DropStage } from "../../utils/dropStage";
import {
  CLOSED_REASON_COPY,
  closedChipLabel,
  getDropClosedReason,
  isDropFull,
  spotsRemaining,
} from "../../utils/dropStatus";
import NotifyMeModal from "./modals/NotifyMeModal";
import { REMINDER_CHOICES, useDropNotify } from "../../api/hooks/useDropHooks";
import { Chip } from "../ui/Chip";
import { Toggle } from "../ui/Toggle";
import { RemoteImage } from "../ui/RemoteImage";
import { Button, ErrorBanner, buttonVariants } from "../forms/controls";
import { STACK, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

type DropFeedCardProps = {
  drop: DropCardData;
  acceptedCount: number;
  feedStatus: DropFeedStatus;
  /** Called when the user clicks Apply on an open drop with spots remaining. */
  onApply: () => void;
  /** True when the org already has an application row for this drop. */
  alreadyApplied: boolean;
  /**
   * Set when this org was accepted. The card opens that My Campaigns detail
   * instead of a dead Applied / Closed action.
   */
  campaignTo?: string;
  /** Read-only mode (e.g. the API slice before writes land in Stage 5). */
  disableApply?: boolean;
};

/** Pen CTA: 36px pill. */
const ctaClass = "h-9 px-4";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function HeroCountdownOverlay({ targetMs }: { targetMs: number }) {
  const { days, hours, minutes, seconds, done } = useCountdown(targetMs);
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-buzz-scrim px-4">
      {done ? (
        <p className={cn(TEXT.h3, "text-primary")}>Opening now</p>
      ) : (
        <div className="text-center">
          <p className={cn(TEXT.micro, "mb-2 text-muted")}>Opens In</p>
          <div className={cn(TEXT.metric, "text-primary")}>
            {days}d {pad2(hours)}:{pad2(minutes)}:{pad2(seconds)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DropFeedCard({
  drop,
  acceptedCount,
  feedStatus,
  onApply,
  alreadyApplied,
  campaignTo,
  disableApply = false,
}: DropFeedCardProps) {
  const remaining = spotsRemaining(drop, acceptedCount);
  const full = isDropFull(drop, acceptedCount);
  const closedReason = getDropClosedReason(drop.stage, full);

  const spots =
    feedStatus === "upcoming"
      ? "Opens soon"
      : feedStatus === "open"
        ? acceptedCount === 0
          ? `Up to ${drop.capacityTotal} spots`
          : `${remaining} of ${drop.capacityTotal} spots remaining`
        : CLOSED_REASON_COPY[closedReason ?? "manual"];

  const action = campaignTo ? (
    <span
      className={cn(buttonVariants({ variant: "secondary" }), ctaClass)}
      data-testid="view-campaign"
    >
      View campaign
    </span>
  ) : feedStatus === "upcoming" ? null : feedStatus === "open" && !full ? (
    <Button
      type="button"
      className={ctaClass}
      data-testid="apply-button"
      onClick={onApply}
      disabled={alreadyApplied || disableApply}
    >
      {alreadyApplied ? "Already applied" : "Apply"}
    </Button>
  ) : feedStatus === "open" && full ? (
    // Dead under getDropFeedStatus (full ⇒ closed). Kept as a guard.
    <Button type="button" variant="secondary" className={ctaClass} disabled>
      {alreadyApplied ? "Applied" : "Spots filled"}
    </Button>
  ) : (
    <Button type="button" variant="secondary" className={ctaClass} disabled>
      {alreadyApplied ? "Applied" : "Closed"}
    </Button>
  );

  const card = (
    <article
      data-testid="drop-card"
      data-drop-id={drop.id}
      className="flex h-full flex-col"
    >
      <div className="group relative flex h-[420px] flex-col overflow-hidden rounded-buzzBoard bg-page p-5">
        <RemoteImage
          src={drop.image}
          label={drop.brandName}
          alt=""
          // The countdown covers the well while upcoming; the icon would sit under it.
          fallback={feedStatus === "upcoming" ? "blank" : "placeholder"}
          className="absolute inset-0 h-full w-full rounded-buzzBoard object-cover"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-page/95 via-page/70 via-30% to-transparent to-75%"
          aria-hidden
        />
        {feedStatus === "upcoming" ? (
          <HeroCountdownOverlay targetMs={drop.applyOpenAt} />
        ) : null}
        <div className="relative flex items-center gap-2">
          <FeedStatusChip status={feedStatus} full={full} stage={drop.stage} />
          <span className="ml-auto text-right text-xs text-primary">{spots}</span>
        </div>
        <div className="relative mt-auto">
          <p className="text-xs font-medium uppercase tracking-[0.05em] text-muted">
            {drop.brandName}
          </p>
          <h3 className={cn(TEXT.h2, "mt-2 line-clamp-3 leading-none text-primary")}>
            {drop.title}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-1 pt-4">
        <p className={cn(TEXT.body, "line-clamp-3 text-muted")}>{drop.description}</p>
        <div className="mt-auto flex min-h-9 items-center gap-2">
          <MapPin size={14} className="shrink-0 text-quiet" aria-hidden />
          <span className="min-w-0 truncate text-xs text-quiet">{drop.location}</span>
          {action ? <span className="ml-auto shrink-0">{action}</span> : null}
        </div>
        {feedStatus === "upcoming" && !campaignTo ? (
          <UpcomingActions drop={drop} />
        ) : null}
      </div>
    </article>
  );

  if (!campaignTo) return card;

  return (
    <Link to={campaignTo} className="block h-full" data-testid="view-campaign-link">
      {card}
    </Link>
  );
}

/** Pen badge on media: dark fill, yellow dot and label while the drop is live. */
function FeedStatusChip({
  status,
  full,
  stage,
}: {
  status: DropFeedStatus;
  full: boolean;
  stage: DropStage;
}) {
  const label =
    status === "upcoming"
      ? "Upcoming"
      : status === "open"
        ? full
          ? "Full"
          : "Open"
        : closedChipLabel(stage);
  const live = status !== "closed" && !full;
  return (
    <Chip onMedia dot className={live ? "text-accent" : "text-muted"}>
      {label}
    </Chip>
  );
}

/** Presentational toggle. */
function NotifyToggle({
  notified,
  reminderMinutes,
  disabled,
  onClick,
}: {
  notified: boolean;
  reminderMinutes: number[];
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-primary">
          {notified ? "Notifying you" : "Notify Me"}
        </span>
        <Toggle
          checked={notified}
          disabled={disabled}
          onChange={() => onClick()}
          label={notified ? "Notifying you" : "Notify Me"}
        />
      </div>
      {notified && reminderMinutes.length > 0 ? (
        <p className={TEXT.meta}>
          Reminders:{" "}
          {reminderMinutes
            .map((minutes) =>
              minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}m`,
            )
            .join(", ")}{" "}
          before
        </p>
      ) : null}
    </>
  );
}

/**
 * The toggle performs a real backend write (POST/DELETE /api/drops/{id}/notify).
 * The backend stores a single lead-time, so a multi-select in the modal collapses
 * to the soonest valid choice. Initial state is sourced from the server
 * (`drop.notifyRequested`/`reminderMinutes`, §6.3.1) so a revisit shows the
 * already-subscribed state; the toggle invalidates the feed so the next render
 * re-reads it.
 */
function UpcomingActions({ drop }: { drop: DropCardData }) {
  const notify = useDropNotify(drop.id);
  const serverMinutes =
    drop.notifyRequested && drop.reminderMinutes != null ? [drop.reminderMinutes] : [];
  const notified = serverMinutes.length > 0;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleConfirm = (selected: number | null) => {
    setFailed(false);
    const opts = { onError: () => setFailed(true) };
    if (selected == null || !(REMINDER_CHOICES as readonly number[]).includes(selected)) {
      notify.mutate(null, opts);
      return;
    }
    notify.mutate(selected, opts);
  };

  return (
    <div className={STACK.tight}>
      <NotifyToggle
        notified={notified}
        reminderMinutes={serverMinutes}
        disabled={notify.isPending}
        onClick={() => setIsModalOpen(true)}
      />
      {failed ? (
        <ErrorBanner>Couldn't update your reminder. Please try again.</ErrorBanner>
      ) : notified ? (
        <p className={cn(TEXT.meta, "text-accent")}>
          You're on the list — we'll let you know when this opens.
        </p>
      ) : null}
      {isModalOpen ? (
        <NotifyMeModal
          dropTitle={drop.title}
          initialSelection={serverMinutes}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirm}
        />
      ) : null}
    </div>
  );
}
