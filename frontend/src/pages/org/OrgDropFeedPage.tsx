/**
 * `/org/browse` — Drop Feed (PRODUCT.md §6.3). Renders all drops with status-aware
 * cards (Upcoming / Open / Closed / Full) plus a status filter chip group.
 *
 * Renders from the real backend (`GET /api/drops`) with working apply, feeding a
 * `DropFeedRow[]` into the shared presentational `FeedContent`.
 */
import { useMemo, useState } from "react";
import DropFeedCard from "../../components/org/DropFeedCard";
import { getDropFeedStatus } from "../../utils/dropStatus";
import type { DropFeedRow, DropFeedStatus } from "../../types/drop";
import { useWallClockNow } from "../../utils/wallClock";
import { useOrgDropFeed } from "../../api/hooks/useOrgDropFeed";
import {
  useApplyToDrop,
  type DropFeedItem,
} from "../../api/hooks/useDropHooks";

type FilterId = "all" | "upcoming" | "open" | "closed";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All drops" },
  { id: "upcoming", label: "Upcoming" },
  { id: "open", label: "Open" },
  { id: "closed", label: "Closed" },
];

function matchesFilter(filter: FilterId, status: DropFeedStatus): boolean {
  if (filter === "all") return true;
  return filter === status;
}

const PAGE_SHELL = "mx-auto max-w-6xl px-8 py-12";

function FeedHeader() {
  return (
    <header className="mb-8 text-center">
      <h1 className="text-3xl font-bold text-buzz-ink">
        Browse <span className="text-buzz-coral">Campaigns</span>
      </h1>
      <p className="mt-2 text-sm font-medium text-buzz-inkMuted">
        Browse open and upcoming drops from the brands in our network.
      </p>
    </header>
  );
}

/** Shared presentational feed: filter chips + status-sorted card grid. */
function FeedContent({
  rows,
  onApply,
  disableApply = false,
}: {
  rows: DropFeedRow[];
  onApply: (dropId: string) => void;
  disableApply?: boolean;
}) {
  const [filter, setFilter] = useState<FilterId>("all");
  // Live wall-clock so a drop flips Upcoming→Open the moment its countdown ends
  // (status/chips/Apply re-derive on each tick, not just on refetch).
  const now = useWallClockNow();

  /** Visible cards after status filter. Drops are sorted: Open -> Upcoming -> Closed. */
  const visibleDrops = useMemo(() => {
    const enriched = rows.map((row) => {
      const status = getDropFeedStatus(row, row.acceptedCount, now);
      return { row, status };
    });
    const sortKey: Record<DropFeedStatus, number> = {
      open: 0,
      upcoming: 1,
      closed: 2,
    };
    return enriched
      .filter((item) => matchesFilter(filter, item.status))
      .sort((a, b) => sortKey[a.status] - sortKey[b.status]);
  }, [rows, now, filter]);

  return (
    <div className={PAGE_SHELL}>
      <FeedHeader />

      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-2 text-sm font-bold shadow-sm transition ${
              filter === f.id
                ? "bg-buzz-coral text-buzz-paper"
                : "border border-buzz-lineMid bg-buzz-paper text-buzz-inkMuted hover:bg-buzz-cream"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibleDrops.length === 0 ? (
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center text-sm font-medium text-buzz-inkMuted">
          No drops match this filter right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {visibleDrops.map(({ row, status }) => {
            return (
              <DropFeedCard
                key={row.id}
                drop={row}
                acceptedCount={row.acceptedCount}
                feedStatus={status}
                alreadyApplied={row.alreadyApplied}
                disableApply={disableApply}
                onApply={() => onApply(row.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Live feed from `GET /api/drops` with working apply. */
function ApiDropFeed() {
  const { items, isLoading, error } = useOrgDropFeed();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  // Survive a refetch that briefly (or incorrectly) returns alreadyApplied=false
  // after a successful POST — otherwise the card flips back to "Apply".
  const [justAppliedIds, setJustAppliedIds] = useState(() => new Set<string>());

  const rows = useMemo(
    () =>
      items.map((row: DropFeedItem) =>
        justAppliedIds.has(row.id) ? { ...row, alreadyApplied: true } : row,
      ),
    [items, justAppliedIds],
  );

  const handleApply = (dropId: string) => {
    setApplyingId(dropId);
  };

  // Simple inline apply: call mutation directly, no modal for now.
  if (applyingId) {
    return (
      <ApiApplyForm
        dropId={applyingId}
        onCancel={() => setApplyingId(null)}
        onSuccess={() => {
          setJustAppliedIds((prev) => {
            const next = new Set(prev);
            next.add(applyingId);
            return next;
          });
          setApplyingId(null);
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className={PAGE_SHELL}>
        <FeedHeader />
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center text-sm font-medium text-buzz-inkMuted">
          Loading drops…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={PAGE_SHELL}>
        <FeedHeader />
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center text-sm font-medium text-buzz-coral">
          Couldn’t load drops. Please try again.
        </div>
      </div>
    );
  }

  return <FeedContent rows={rows} onApply={handleApply} disableApply={false} />;
}

/** Inline apply form shown when user clicks Apply on a drop card. */
function ApiApplyForm({
  dropId,
  onCancel,
  onSuccess,
}: {
  dropId: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const mutation = useApplyToDrop(dropId);
  const [pitch, setPitch] = useState("");

  const handleSubmit = () => {
    // Only dismiss on success — on failure keep the form (and the typed pitch)
    // open so the inline error shows and the user can retry. Await mutateAsync
    // so the hook's optimistic alreadyApplied + invalidate finish before we
    // remount the feed (otherwise E2E still sees "Apply").
    void mutation.mutateAsync(pitch || undefined).then(() => onSuccess());
  };

  return (
    <div className={PAGE_SHELL}>
      <FeedHeader />
      <div className="mx-auto max-w-md rounded-2xl border border-buzz-lineMid bg-buzz-paper p-8 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-buzz-ink">Apply to Drop</h2>
        <textarea
          placeholder="Optional pitch message..."
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          rows={4}
          className="mb-4 w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-buzz-lineMid px-4 py-2 text-sm font-bold text-buzz-inkMuted hover:bg-buzz-cream"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="apply-submit"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 rounded-lg bg-buzz-coral px-4 py-2 text-sm font-bold text-buzz-paper hover:bg-buzz-coralDark disabled:opacity-60"
          >
            {mutation.isPending ? "Submitting..." : "Submit"}
          </button>
        </div>
        {mutation.error ? (
          <p className="mt-3 text-sm font-medium text-buzz-coral">
            {mutation.error instanceof Error ? mutation.error.message : "Failed to apply."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function OrgDropFeedPage() {
  return <ApiDropFeed />;
}
