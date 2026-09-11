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
import { useApplyToDrop } from "../../api/hooks/useDropHooks";
import PageShell from "../../components/site/PageShell";
import { Card } from "../../components/ui/Card";
import { QueryStatePanel, StatePanel } from "../../components/ui/StatePanel";
import {
  Button,
  ErrorBanner,
  TextArea,
} from "../../components/forms/controls";
import { GAP, STACK, TEXT } from "../../theme/tokens";
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
      <ApiApplyForm
        dropId={applyingId}
        onCancel={() => setApplyingId(null)}
        onSuccess={() => {
          setApplyingId(null);
        }}
      />
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
    <PageShell width="wide">
      <FeedHeader />
      <Card kind="card" pad="roomy" className="mx-auto max-w-md">
        <h2 className={cn(TEXT.h2, "mb-4")}>Apply to Drop</h2>
        <div className={STACK.default}>
          <TextArea
            placeholder="Optional pitch message..."
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            rows={4}
          />
          <div className={cn("flex", GAP.tight)}>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="apply-submit"
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="flex-1"
            >
              {mutation.isPending ? "Submitting..." : "Submit"}
            </Button>
          </div>
          {mutation.error ? (
            <ErrorBanner>
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Failed to apply."}
            </ErrorBanner>
          ) : null}
        </div>
      </Card>
    </PageShell>
  );
}

export default function OrgDropFeedPage() {
  return <ApiDropFeed />;
}
