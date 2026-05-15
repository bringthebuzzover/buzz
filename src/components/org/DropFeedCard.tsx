/**
 * Org-side drop feed card. Renders status-aware copy and a primary CTA per
 * `DropFeedStatus` (Upcoming / Open / Closed). Per PRODUCT.md §6.3 and §7 there is
 * no waitlist; when capacity is full the drop is Closed on the feed for new applies.
 *
 * - Upcoming: countdown to `applyOpenAt` + Notify Me toggle.
 * - Open: Apply when spots remain under spec rules.
 * - Closed: disabled action with reason chip.
 *
 * The card is presentational; data fetching + mutations are wired by the parent
 * (`OrgDropFeedPage`) and the apply modal (`ApplyToDropModal`).
 */
import { useMemo, useState, useSyncExternalStore } from "react";
import { Bell, BellRing, Calendar, MapPin } from "lucide-react";
import type { Drop, DropFeedStatus } from "../../types/drop";
import { useCountdown } from "../../utils/useCountdown";
import {
  CLOSED_REASON_COPY,
  getDropClosedReason,
  isDropFull,
  spotsRemaining,
} from "../../utils/dropStatus";
import { useDemoNow } from "../../contexts/DemoClockContext";
import {
  getDropReminderMinutes,
  isDropNotified,
  setDropReminderMinutes,
} from "../../utils/notifyMe";
import NotifyMeModal from "./modals/NotifyMeModal";

type DropFeedCardProps = {
  drop: Drop;
  acceptedCount: number;
  feedStatus: DropFeedStatus;
  /** Called when the user clicks Apply on an open drop with spots remaining. */
  onApply: () => void;
  /** Called when the user clicks Join Waitlist on a full but open drop. */
  onJoinWaitlist: () => void;
  /** True when the org already has an application/waitlist row for this drop. */
  alreadyApplied: boolean;
};

/** Subscribes to localStorage so multiple cards re-render when one toggles Notify Me. */
function useDropNotifiedFlag(dropId: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const handler = (e: StorageEvent) => {
        if (!e.key || e.key.endsWith(`.notify.${dropId}`)) notify();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    () => isDropNotified(dropId),
    () => false,
  );
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function HeroCountdownOverlay({ targetMs }: { targetMs: number }) {
  const { days, hours, minutes, seconds, done } = useCountdown(targetMs);
  if (done) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-buzz-overlay/35">
        <p className="text-2xl font-black text-buzz-paper drop-shadow">
          Opening now
        </p>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-buzz-overlay/35 px-4">
      <div className="text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-buzz-paper/90">
          Opens In
        </p>
        <div className="text-4xl font-black tabular-nums text-buzz-paper drop-shadow sm:text-5xl">
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
  onJoinWaitlist,
  alreadyApplied,
}: DropFeedCardProps) {
  const now = useDemoNow();
  const remaining = spotsRemaining(drop, acceptedCount);
  const full = isDropFull(drop, acceptedCount);
  const closedReason = useMemo(
    () => getDropClosedReason(drop, acceptedCount, now),
    [drop, acceptedCount, now],
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-buzz-lineMid bg-buzz-butter shadow-sm transition hover:shadow-md">
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
          <span className="rounded-full bg-buzz-coral px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-buzz-paper shadow-sm">
            {drop.brandName}
          </span>
          <FeedStatusChip status={feedStatus} full={full} />
        </div>
      </div>

      <div className="flex flex-1 flex-col bg-buzz-butter p-6">
        <h3 className="mb-2 text-xl font-bold leading-tight text-buzz-coral">
          {drop.title}
        </h3>
        <p className="mb-4 line-clamp-3 text-sm font-medium text-buzz-inkMuted">
          {drop.description}
        </p>

        <div className="mb-4 flex items-center gap-4 text-xs font-bold text-buzz-inkMuted">
          <span className="flex items-center gap-1">
            <MapPin size={14} className="text-buzz-coral" />
            {drop.location}
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={14} className="text-buzz-coral" />
            {feedStatus === "upcoming"
              ? "Opens soon"
              : feedStatus === "open"
                ? `${remaining} of ${drop.capacityTotal} spots remaining`
                : closedReason
                  ? CLOSED_REASON_COPY[closedReason]
                  : "Closed"}
          </span>
        </div>

        <div className="mt-auto">
          {feedStatus === "upcoming" ? (
            <UpcomingActions drop={drop} />
          ) : feedStatus === "open" && !full ? (
            <button
              type="button"
              onClick={onApply}
              disabled={alreadyApplied}
              className="w-full rounded-lg bg-buzz-coral py-3 font-semibold text-buzz-paper shadow-sm transition hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {alreadyApplied ? "Already applied" : "Apply"}
            </button>
          ) : feedStatus === "open" && full ? (
            <button
              type="button"
              onClick={onJoinWaitlist}
              disabled={alreadyApplied}
              className="w-full rounded-lg border-2 border-buzz-coral bg-buzz-paper py-3 font-semibold text-buzz-coral shadow-sm transition hover:bg-buzz-cream disabled:cursor-not-allowed disabled:opacity-60"
            >
              {alreadyApplied ? "On the waitlist" : "Join Waitlist"}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-buzz-lineMid bg-buzz-cream py-3 font-semibold text-buzz-inkMuted"
            >
              Closed
            </button>
          )}
        </div>
      </div>
    </div>
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
  const tone =
    status === "open" && !full
      ? "bg-emerald-100 text-emerald-800"
      : status === "upcoming"
        ? "bg-buzz-butter text-buzz-ink"
        : "bg-buzz-cream text-buzz-inkMuted";
  return (
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${tone}`}
    >
      {label}
    </span>
  );
}

function UpcomingActions({ drop }: { drop: Drop }) {
  const notified = useDropNotifiedFlag(drop.id);
  const reminderMinutes = getDropReminderMinutes(drop.id);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleNotify = () => {
    setIsModalOpen(true);
  };

  const handleConfirmReminders = (selectedMinutes: number[]) => {
    setDropReminderMinutes(drop.id, selectedMinutes);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleNotify}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-buzz-coral bg-buzz-paper py-3 font-semibold text-buzz-coral shadow-sm transition hover:bg-buzz-cream"
      >
        {notified ? <BellRing size={16} /> : <Bell size={16} />}
        <span>{notified ? "Notifying you" : "Notify Me"}</span>
      </button>
      {notified && reminderMinutes.length > 0 ? (
        <p className="text-center text-[11px] font-semibold text-buzz-inkMuted">
          Reminders:{" "}
          {reminderMinutes
            .map((minutes) =>
              minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}m`,
            )
            .join(", ")}{" "}
          before
        </p>
      ) : null}
      {isModalOpen ? (
        <NotifyMeModal
          dropTitle={drop.title}
          initialSelection={
            reminderMinutes.length > 0 ? reminderMinutes : notified ? [15] : []
          }
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmReminders}
        />
      ) : null}
    </div>
  );
}
