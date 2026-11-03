/** `/org/browse` — current, eligible drops in a responsive grid. */
import { useState } from "react";
import DropFeedCard from "../../components/org/DropFeedCard";
import { useOrgDropFeed } from "../../api/hooks/useOrgDropFeed";
import type { OrgDropFeedFilter } from "../../api/hooks/useDropHooks";
import { useCampaigns, type CampaignItem } from "../../api/hooks/useOrgHooks";
import PageShell from "../../components/site/PageShell";
import { QueryStatePanel } from "../../components/ui/StatePanel";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { filterChipClass } from "../../components/ui/navItem";
import { Button } from "../../components/forms/controls";

const FILTERS: { id: OrgDropFeedFilter; label: string }[] = [
  { id: "all", label: "All drops" },
  { id: "upcoming", label: "Upcoming" },
  { id: "open", label: "Open" },
];

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

export default function OrgDropFeedPage() {
  const [filter, setFilter] = useState<OrgDropFeedFilter>("all");
  const {
    items,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useOrgDropFeed(filter);
  const { data: campaigns } = useCampaigns();

  return (
    <PageShell width="wide">
      <FeedHeader />
      <div className="mb-8 flex flex-wrap gap-2" aria-label="Drop filters">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={filterChipClass(filter === item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <section aria-labelledby="current-drops">
        <h2 id="current-drops" className="mb-6 text-xl font-medium text-primary">
          Current drops
        </h2>
        {isLoading || error ? (
          <>
            <QueryStatePanel isPending={isLoading} isError={Boolean(error)} label="drops" />
            {error ? (
              <div className="mt-4 flex justify-center">
                <Button type="button" variant="outline" onClick={() => void refetch()}>
                  Try again
                </Button>
              </div>
            ) : null}
          </>
        ) : items.length === 0 ? (
          <EmptyState title="No current drops" />
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
            {items.map((drop) => (
              <DropFeedCard
                key={drop.id}
                drop={drop}
                acceptedCount={drop.acceptedCount}
                feedStatus={drop.stage === "upcoming" ? "upcoming" : "open"}
                alreadyApplied={drop.alreadyApplied}
                campaignTo={acceptedCampaignPath(campaigns, drop.id)}
              />
            ))}
          </div>
        )}
      </section>
      {hasNextPage ? (
        <div className="mt-10 flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading…" : "Load more drops"}
          </Button>
        </div>
      ) : null}
    </PageShell>
  );
}
