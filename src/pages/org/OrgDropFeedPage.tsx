/**
 * `/org/drops` — Drop Feed (PRODUCT.md §6.3). Renders all drops with status-aware
 * cards (Upcoming / Open / Closed / Full) plus a status filter chip group. Apply
 * and Join Waitlist mutations both go through `ApplyToDropModal`, which writes a
 * new application row.
 *
 * `acceptedCount` per drop is derived from the applications snapshot so cards
 * recompute fill counts automatically when the demo accepts new applicants.
 */
import { useMemo, useState } from "react";
import DropFeedCard from "../../components/org/DropFeedCard";
import ApplyToDropModal from "../../components/org/modals/ApplyToDropModal";
import {
  useApplications,
  useDrops,
} from "../../contexts/MockDataContext";
import { useDemoNow } from "../../contexts/DemoClockContext";
import { getDropFeedStatus, isDropFull } from "../../utils/dropStatus";
import type { Drop, DropFeedStatus } from "../../types/drop";
import { DEMO_ORG_ID } from "../../data/seed/seedOrgs";

type FilterId = "all" | "upcoming" | "open" | "closed";

type ModalState =
  | { kind: "closed" }
  | { kind: "apply"; drop: Drop }
  | { kind: "waitlist"; drop: Drop };

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

export default function OrgDropFeedPage() {
  const drops = useDrops();
  const applications = useApplications();
  const now = useDemoNow();
  const [filter, setFilter] = useState<FilterId>("all");
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });

  /** Map of dropId -> accepted application count (used to derive feed status). */
  const acceptedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const app of applications) {
      if (app.decision !== "accepted") continue;
      counts.set(app.dropId, (counts.get(app.dropId) ?? 0) + 1);
    }
    return counts;
  }, [applications]);

  /** Set of drop ids the demo org has already applied/waitlisted on. */
  const myDropIds = useMemo(() => {
    const set = new Set<string>();
    for (const app of applications) {
      if (app.orgId !== DEMO_ORG_ID) continue;
      if (app.decision === "denied") continue;
      set.add(app.dropId);
    }
    return set;
  }, [applications]);

  /** Visible cards after status filter. Drops are sorted: Open -> Upcoming -> Closed. */
  const visibleDrops = useMemo(() => {
    const enriched = drops.map((drop) => {
      const acceptedCount = acceptedCounts.get(drop.id) ?? 0;
      const status = getDropFeedStatus(drop, acceptedCount, now);
      return { drop, acceptedCount, status };
    });
    const sortKey: Record<DropFeedStatus, number> = {
      open: 0,
      upcoming: 1,
      closed: 2,
    };
    return enriched
      .filter((row) => matchesFilter(filter, row.status))
      .sort((a, b) => sortKey[a.status] - sortKey[b.status]);
  }, [drops, acceptedCounts, now, filter]);

  return (
    <div className="mx-auto max-w-6xl px-8 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-buzz-ink">
          Browse <span className="text-buzz-coral">Campaigns</span>
        </h1>
        <p className="mt-2 text-sm font-medium text-buzz-inkMuted">
          Browse open and upcoming drops from the brands in our network.
        </p>
      </header>

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
          {visibleDrops.map(({ drop, acceptedCount, status }) => {
            const full = isDropFull(drop, acceptedCount);
            return (
              <DropFeedCard
                key={drop.id}
                drop={drop}
                acceptedCount={acceptedCount}
                feedStatus={status}
                alreadyApplied={myDropIds.has(drop.id)}
                onApply={() => setModal({ kind: "apply", drop })}
                onJoinWaitlist={() =>
                  setModal({
                    kind: full ? "waitlist" : "apply",
                    drop,
                  })
                }
              />
            );
          })}
        </div>
      )}

      {modal.kind !== "closed" ? (
        <ApplyToDropModal
          drop={modal.drop}
          mode={modal.kind === "waitlist" ? "waitlist" : "apply"}
          onClose={() => setModal({ kind: "closed" })}
        />
      ) : null}
    </div>
  );
}
