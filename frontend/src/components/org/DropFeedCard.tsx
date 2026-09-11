/**
 * Org-side drop feed card. Renders status-aware copy and a primary CTA per
 * `DropFeedStatus` (Upcoming / Open / Closed). Per PRODUCT.md §6.3 and §7.2 there
 * is no waitlist; capacity-Closed (after finalize, or reopen leftovers) shows
 * Closed on the feed for new applies — not mid-window fill during first Open.
 *
 * - Upcoming: countdown to `applyOpenAt` + Notify Me toggle.
 * - Open: Apply; spots copy is "Up to N" when no prior accepts, else "M of N remaining".
 * - Closed: disabled action with reason chip.
 *
 * The card is presentational; data fetching + mutations are wired by the parent
 * (`OrgDropFeedPage`) and the inline apply form.
 */
import { useMemo, useState } from "react";
import { Bell, BellRing, Calendar, MapPin } from "lucide-react";
import type { DropCardData, DropFeedStatus } from "../../types/drop";
import { useCountdown } from "../../utils/useCountdown";
import {
  CLOSED_REASON_COPY,
  getDropClosedReason,
  isDropFull,
  spotsRemaining,
} from "../../utils/dropStatus";
import { useWallClockNow } from "../../utils/wallClock";
import NotifyMeModal from "./modals/NotifyMeModal";
import { REMINDER_CHOICES, useDropNotify } from "../../api/hooks/useDropHooks";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { Button, ErrorBanner } from "../forms/controls";
import { PAD, STACK, TEXT, type Tone } from "../../theme/tokens";
import { cn } from "../../theme/cn";

type DropFeedCardProps = {
  drop: DropCardData;
  acceptedCount: number;
  feedStatus: DropFeedStatus;
  /** Called when the user clicks Apply on an open drop with spots remaining. */
  onApply: () => void;
  /** True when the org already has an application row for this drop. */
  alreadyApplied: boolean;
  /** Read-only mode (e.g. the API slice before writes land in Stage 5). */
  disableApply?: boolean;
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function HeroCountdownOverlay({ targetMs }: { targetMs: number }) {
  const { days, hours, minutes, seconds, done } = useCountdown(targetMs);
  if (done) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-buzz-overlay/35">
        <p className={cn(TEXT.h2, "text-buzz-paper drop-shadow")}>Opening now</p>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-buzz-overlay/35 px-4">
      <div className="text-center">
        <p className={cn(TEXT.micro, "mb-2 text-buzz-paper/90")}>Opens In</p>
        <div className={cn(TEXT.metric, "text-buzz-paper drop-shadow")}>
          {days}d {pad2(hours)}:{pad2(minutes)}:{pad2(seconds)}
        </div>
      </div>
    </div>
  );
}

export default function DropFeedCard({
  drop,
  acceptedCount,
  feedStatus,
  onApply,
  alreadyApplied,
  disableApply = false,
}: DropFeedCardProps) {
  const now = useWallClockNow();
  const remaining = spotsRemaining(drop, acceptedCount);
  const full = isDropFull(drop, acceptedCount);
  const closedReason = useMemo(
    () => getDropClosedReason(drop, acceptedCount, now),
    [drop, acceptedCount, now],
  );

  return (
    <Card
      kind="cardWarm"
      pad="none"
      data-testid="drop-card"
      className="flex h-full flex-col overflow-hidden shadow-buzz transition hover:shadow-buzzLg"
    >
      <div className="relative h-48 overflow-hidden border-b border-buzz-lineMid">
        <img
          src={drop.image}
          alt={drop.title}
          className="h-full w-full object-cover"
        />
        {feedStatus === "upcoming" ? (
          <HeroCountdownOverlay targetMs={drop.applyOpenAt} />
        ) : null}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Chip accent>{drop.brandName}</Chip>
          <FeedStatusChip status={feedStatus} full={full} />
        </div>
      </div>

      <div className={cn("flex flex-1 flex-col", PAD.card)}>
        <h3 className={cn(TEXT.h3, "mb-2 leading-tight text-buzz-coral")}>
          {drop.title}
        </h3>
        <p className={cn(TEXT.body, "mb-4 line-clamp-3 text-buzz-inkMuted")}>
          {drop.description}
        </p>

        <div className={cn(TEXT.meta, "mb-4 flex items-center gap-4 font-semibold")}>
          <span className="flex items-center gap-1">
            <MapPin size={14} className="text-buzz-coral" />
            {drop.location}
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={14} className="text-buzz-coral" />
            {feedStatus === "upcoming"
              ? "Opens soon"
              : feedStatus === "open"
                ? acceptedCount === 0
                  ? `Up to ${drop.capacityTotal} spots`
                  : `${remaining} of ${drop.capacityTotal} spots remaining`
                : closedReason
                  ? CLOSED_REASON_COPY[closedReason]
                  : "Closed"}
          </span>
        </div>

        <div className="mt-auto">
          {feedStatus === "upcoming" ? (
            <UpcomingActions drop={drop} />
          ) : feedStatus === "open" && !full ? (
            <Button
              type="button"
              fullWidth
              data-testid="apply-button"
              onClick={onApply}
              disabled={alreadyApplied || disableApply}
            >
              {alreadyApplied ? "Already applied" : "Apply"}
            </Button>
          ) : feedStatus === "open" && full ? (
            // Dead under getDropFeedStatus (full ⇒ closed). Kept as a guard.
            // PRODUCT.md §7.2: capacity-Closed after finalize / reopen leftovers.
            <Button type="button" fullWidth disabled>
              {alreadyApplied ? "Applied" : "Spots filled"}
            </Button>
          ) : (
            <Button type="button" fullWidth disabled>
              {alreadyApplied ? "Applied" : "Closed"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function FeedStatusChip({
  status,
  full,
}: {
  status: DropFeedStatus;
  full: boolean;
}) {
  const label =
    status === "upcoming"
      ? "Upcoming"
      : status === "open"
        ? full
          ? "Full"
          : "Open"
        : "Closed";
  const tone: Tone = status === "open" && !full ? "success" : "neutral";
  return <Chip tone={tone}>{label}</Chip>;
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
      <Button
        type="button"
        variant="outline"
        fullWidth
        onClick={onClick}
        disabled={disabled}
      >
        {notified ? <BellRing size={16} /> : <Bell size={16} />}
        <span>{notified ? "Notifying you" : "Notify Me"}</span>
      </Button>
      {notified && reminderMinutes.length > 0 ? (
        <p className={cn(TEXT.meta, "text-center")}>
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
    drop.notifyRequested && drop.reminderMinutes != null
      ? [drop.reminderMinutes]
      : [];
  const notified = serverMinutes.length > 0;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleConfirm = (selected: number | null) => {
    setFailed(false);
    const opts = { onError: () => setFailed(true) };
    if (
      selected == null ||
      !(REMINDER_CHOICES as readonly number[]).includes(selected)
    ) {
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
        <ErrorBanner>
          Couldn't update your reminder. Please try again.
        </ErrorBanner>
      ) : notified ? (
        <p className={cn(TEXT.meta, "text-center text-buzz-coral")}>
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
