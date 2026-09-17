/**
 * `/org/browse` — Drop Feed (PRODUCT.md §6.3). Renders all drops with status-aware
 * cards (Upcoming / Open / Closed / Full) plus a status filter chip group.
 *
 * Renders from the real backend (`GET /api/drops`) with working apply, feeding a
 * `DropFeedRow[]` into the shared presentational `FeedContent`.
 */
import { useMemo, useState } from "react";
import DropFeedCard from "../../components/org/DropFeedCard";
import DropApplyForm from "../../components/org/DropApplyForm";
import { getDropFeedStatus } from "../../utils/dropStatus";
import type { DropFeedRow, DropFeedStatus } from "../../types/drop";
import { useWallClockNow } from "../../utils/wallClock";
import { useOrgDropFeed } from "../../api/hooks/useOrgDropFeed";
import PageShell from "../../components/site/PageShell";
import { QueryStatePanel, StatePanel } from "../../components/ui/StatePanel";
import { Button } from "../../components/forms/controls";
import { GAP, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

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

function FeedHeader() {
  return (
    <header className="mb-8 text-center">
      <h1 className={TEXT.h1}>
        Browse <span className="text-buzz-coral">Campaigns</span>
      </h1>
      <p className={cn(TEXT.body, "mt-2 text-buzz-inkMuted")}>
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
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: {
  rows: DropFeedRow[];
  onApply: (dropId: string) => void;
  disableApply?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
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
    <PageShell width="wide">
      <FeedHeader />

      <div className={cn("mb-8 flex flex-wrap justify-center", GAP.tight)}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              filter === f.id
                ? "bg-buzz-coral text-buzz-paper"
                : "border border-buzz-lineMid bg-buzz-paper text-buzz-inkMuted hover:bg-buzz-cream",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibleDrops.length === 0 ? (
        <StatePanel>No drops match this filter right now.</StatePanel>
      ) : (
        <div className={cn("grid sm:grid-cols-2 lg:grid-cols-3", GAP.section)}>
          {visibleDrops.map(({ row, status }) => (
            <DropFeedCard
              key={row.id}
              drop={row}
              acceptedCount={row.acceptedCount}
              feedStatus={status}
              alreadyApplied={row.alreadyApplied}
              disableApply={disableApply}
              onApply={() => onApply(row.id)}
            />
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="mt-10 flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading…" : "Load more drops"}
          </Button>
        </div>
      ) : null}
    </PageShell>
  );
}

/**
 * Live feed from `GET /api/drops` with working apply.
 *
 * Post-apply "Already applied" is owned by `useApplyToDrop` (optimistic cache
 * flip + re-assert after invalidate). Do not keep a page-level sticky Set —
 * that blocked re-apply after denial when the API correctly returned false.
 */
function ApiDropFeed() {
  const {
    items,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useOrgDropFeed();
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleApply = (dropId: string) => {
    setApplyingId(dropId);
  };

  // Simple inline apply: call mutation directly, no modal for now.
  if (applyingId) {
    return (
      <PageShell width="wide">
        <FeedHeader />
        <DropApplyForm
          dropId={applyingId}
          onCancel={() => setApplyingId(null)}
          onSuccess={() => setApplyingId(null)}
        />
      </PageShell>
    );
  }

  if (isLoading || error) {
    return (
      <PageShell width="wide">
        <FeedHeader />
        <QueryStatePanel
          isPending={isLoading}
          isError={Boolean(error)}
          label="drops"
        />
      </PageShell>
    );
  }

  return (
    <FeedContent
      rows={items}
      onApply={handleApply}
      disableApply={false}
      hasMore={hasNextPage}
      isLoadingMore={isFetchingNextPage}
      onLoadMore={() => void fetchNextPage()}
    />
  );
}

export default function OrgDropFeedPage() {
  return <ApiDropFeed />;
}
