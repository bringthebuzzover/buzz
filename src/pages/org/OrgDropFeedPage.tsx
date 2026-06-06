/**
 * `/org/browse` — Drop Feed (PRODUCT.md §6.3). Renders all drops with status-aware
 * cards (Upcoming / Open / Closed / Full) plus a status filter chip group.
 *
 * Stage 4 (strangler): behind `USE_API` this page renders from the real backend
 * (`GET /api/drops`, read-only — apply is disabled until Stage 5). With the flag
 * off it keeps the original demo behavior (localStorage stores + demo clock +
 * the apply/waitlist modal) unchanged. Both paths feed the same `DropFeedRow[]`
 * into the shared presentational `FeedContent`.
 */
import { useMemo, useState } from "react";
import DropFeedCard from "../../components/org/DropFeedCard";
import ApplyToDropModal from "../../components/org/modals/ApplyToDropModal";
import { useApplications, useDrops } from "../../contexts/MockDataContext";
import { useDemoNow } from "../../contexts/DemoClockContext";
import { getDropFeedStatus, isDropFull } from "../../utils/dropStatus";
import type { Drop, DropFeedRow, DropFeedStatus } from "../../types/drop";
import { DEMO_ORG_ID } from "../../data/seed/seedOrgs";
import { USE_API } from "../../config/featureFlags";
import { useOrgDropFeed } from "../../api/hooks/useOrgDropFeed";
import { useApplyToDrop } from "../../api/hooks/useDropHooks";

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
  now,
  onApply,
  onJoinWaitlist,
  disableApply = false,
}: {
  rows: DropFeedRow[];
  now: number;
  onApply: (dropId: string) => void;
  onJoinWaitlist: (dropId: string) => void;
  disableApply?: boolean;
}) {
  const [filter, setFilter] = useState<FilterId>("all");

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
                onJoinWaitlist={() => onJoinWaitlist(row.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

type ModalState =
  | { kind: "closed" }
  | { kind: "apply"; drop: Drop }
  | { kind: "waitlist"; drop: Drop };

/** Demo path: localStorage stores + demo clock + working apply/waitlist modal. */
function DemoDropFeed() {
  const drops = useDrops();
  const applications = useApplications();
  const now = useDemoNow();
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });

  const acceptedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const app of applications) {
      if (app.decision !== "accepted") continue;
      counts.set(app.dropId, (counts.get(app.dropId) ?? 0) + 1);
    }
    return counts;
  }, [applications]);

  const myDropIds = useMemo(() => {
    const set = new Set<string>();
    for (const app of applications) {
      if (app.orgId !== DEMO_ORG_ID) continue;
      if (app.decision === "denied") continue;
      set.add(app.dropId);
    }
    return set;
  }, [applications]);

  const rows = useMemo<DropFeedRow[]>(
    () =>
      drops.map((drop) => ({
        id: drop.id,
        brandName: drop.brandName,
        title: drop.title,
        description: drop.description,
        image: drop.image,
        location: drop.location,
        capacityTotal: drop.capacityTotal,
        applyOpenAt: drop.applyOpenAt,
        applyCloseAt: drop.applyCloseAt,
        manualReopen: drop.manualReopen,
        acceptedCount: acceptedCounts.get(drop.id) ?? 0,
        alreadyApplied: myDropIds.has(drop.id),
      })),
    [drops, acceptedCounts, myDropIds],
  );

  const openModal = (kind: "apply" | "waitlist") => (dropId: string) => {
    const drop = drops.find((d) => d.id === dropId);
    if (!drop) return;
    const acceptedCount = acceptedCounts.get(dropId) ?? 0;
    const full = isDropFull(drop, acceptedCount);
    setModal({ kind: kind === "waitlist" && full ? "waitlist" : "apply", drop });
  };

  return (
    <>
      <FeedContent
        rows={rows}
        now={now}
        onApply={openModal("apply")}
        onJoinWaitlist={openModal("waitlist")}
      />
      {modal.kind !== "closed" ? (
        <ApplyToDropModal
          drop={modal.drop}
          mode={modal.kind === "waitlist" ? "waitlist" : "apply"}
          onClose={() => setModal({ kind: "closed" })}
        />
      ) : null}
    </>
  );
}

/** API path (Stage 6): live feed from `GET /api/drops` with working apply. */
function ApiDropFeed() {
  const { items, isLoading, error } = useOrgDropFeed();
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleApply = (dropId: string) => {
    setApplyingId(dropId);
  };

  // Simple inline apply: call mutation directly, no modal for now.
  if (applyingId) {
    return <ApiApplyForm dropId={applyingId} onDone={() => setApplyingId(null)} />;
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

  return (
    <FeedContent
      rows={items}
      now={Date.now()}
      onApply={handleApply}
      onJoinWaitlist={handleApply}
      disableApply={false}
    />
  );
}

/** Inline apply form shown when user clicks Apply on a drop card. */
function ApiApplyForm({ dropId, onDone }: { dropId: string; onDone: () => void }) {
  const mutation = useApplyToDrop(dropId);
  const [pitch, setPitch] = useState("");

  const handleSubmit = () => {
    // Only dismiss on success — on failure keep the form (and the typed pitch)
    // open so the inline error shows and the user can retry.
    mutation.mutate(pitch || undefined, {
      onSuccess: () => onDone(),
    });
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
            onClick={onDone}
            className="flex-1 rounded-lg border border-buzz-lineMid px-4 py-2 text-sm font-bold text-buzz-inkMuted hover:bg-buzz-cream"
          >
            Cancel
          </button>
          <button
            type="button"
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
  return USE_API ? <ApiDropFeed /> : <DemoDropFeed />;
}
