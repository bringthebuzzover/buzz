/**
 * `/org/browse` — Drop Feed (buzz-ops product/PRODUCT.md §6.3). Renders all drops with status-aware
 * cards (Upcoming / Open / Closed / Full) plus a status filter chip group.
 * Pen: page head, filter chips, then the "Current drops" track with arrows.
 *
 * Renders from the real backend (`GET /api/drops`) with working apply, feeding a
 * `DropFeedRow[]` into the shared presentational `FeedContent`.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import DropFeedCard from "../../components/org/DropFeedCard";
import DropApplyForm from "../../components/org/DropApplyForm";
import { getDropFeedStatus, isDropFull } from "../../utils/dropStatus";
import type { DropFeedRow, DropFeedStatus } from "../../types/drop";
import { useOrgDropFeed } from "../../api/hooks/useOrgDropFeed";
import { useCampaigns, type CampaignItem } from "../../api/hooks/useOrgHooks";
import PageShell from "../../components/site/PageShell";
import { QueryStatePanel } from "../../components/ui/StatePanel";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { filterChipClass } from "../../components/ui/navItem";
import { Button } from "../../components/forms/controls";
import { TEXT } from "../../theme/tokens";
import { focusRingClass } from "../../theme/controls";
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
    <PageHeader
      className="mb-10"
      kicker="Organization Portal"
      title="Browse campaigns"
      description="Browse open and upcoming drops from the brands in our network."
    />
  );
}

/** Pen carousel arrow: 40px ring. */
function CarouselButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border border-primary text-primary transition disabled:opacity-30",
        focusRingClass,
      )}
    >
      {children}
    </button>
  );
}

/** One card plus the 24px gap. */
const CARD_STEP_PX = 376;

/** Horizontal drop track. The arrows scroll it one card at a time. */
function DropTrack({ children, count }: { children: ReactNode; count: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const updateEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 0,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges, count]);

  const scroll = (direction: 1 | -1) =>
    trackRef.current?.scrollBy({
      left: direction * CARD_STEP_PX,
      behavior: "smooth",
    });

  return (
    <section aria-labelledby="current-drops">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 id="current-drops" className={TEXT.h3}>
          Current drops
        </h2>
        <div className="flex gap-3">
          <CarouselButton
            label="Previous drops"
            disabled={edges.start}
            onClick={() => scroll(-1)}
          >
            <ArrowLeft size={18} aria-hidden />
          </CarouselButton>
          <CarouselButton
            label="Next drops"
            disabled={edges.end}
            onClick={() => scroll(1)}
          >
            <ChevronRight size={18} aria-hidden />
          </CarouselButton>
        </div>
      </div>
      <div
        ref={trackRef}
        onScroll={updateEdges}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2 [scrollbar-width:none]"
      >
        {children}
      </div>
    </section>
  );
}

/** My Campaigns detail for an accepted seat on this drop, if the org has one. */
export function acceptedCampaignPath(
  campaigns: CampaignItem[] | undefined,
  dropId: string,
): string | undefined {
  const match = campaigns?.find(
    (campaign) => campaign.dropId === dropId && campaign.decision === "accepted",
  );
  return match ? `/org/campaigns/${match.id}` : undefined;
}

function FeedContent({
  rows,
  onApply,
  campaignPath,
  disableApply = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: {
  rows: DropFeedRow[];
  onApply: (dropId: string) => void;
  campaignPath?: (dropId: string) => string | undefined;
  disableApply?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const [filter, setFilter] = useState<FilterId>("all");

  /** Visible cards after status filter. Drops are sorted: Open -> Upcoming -> Closed. */
  const visibleDrops = useMemo(() => {
    const enriched = rows.map((row) => {
      const status = getDropFeedStatus(row.stage, isDropFull(row, row.acceptedCount));
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
  }, [rows, filter]);

  return (
    <PageShell width="wide">
      <FeedHeader />

      <div className="mb-10 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={filterChipClass(filter === f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibleDrops.length === 0 ? (
        <EmptyState title="No drops match this filter right now." />
      ) : (
        <DropTrack count={visibleDrops.length}>
          {visibleDrops.map(({ row, status }) => (
            <div key={row.id} className="w-[300px] shrink-0 snap-start sm:w-[352px]">
              <DropFeedCard
                drop={row}
                acceptedCount={row.acceptedCount}
                feedStatus={status}
                alreadyApplied={row.alreadyApplied}
                campaignTo={campaignPath?.(row.id)}
                disableApply={disableApply}
                onApply={() => onApply(row.id)}
              />
            </div>
          ))}
        </DropTrack>
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
  const { items, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useOrgDropFeed();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const { data: campaigns } = useCampaigns();

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
        <QueryStatePanel isPending={isLoading} isError={Boolean(error)} label="drops" />
      </PageShell>
    );
  }

  return (
    <FeedContent
      rows={items}
      onApply={handleApply}
      campaignPath={(dropId) => acceptedCampaignPath(campaigns, dropId)}
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
