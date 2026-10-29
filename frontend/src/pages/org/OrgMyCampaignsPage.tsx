/**
 * `/org/campaigns` — My Campaigns (buzz-ops product/PRODUCT.md §6.4).
 *
 * Renders from the real backend (GET /api/campaigns). The status chips filter
 * the loaded rows on the client; Accepted covers accepted and active seats.
 */
import { useMemo, useState } from "react";
import CampaignRow from "../../components/org/CampaignRow";
import { useCampaigns } from "../../api/hooks/useOrgHooks";
import type { CampaignItem } from "../../api/hooks/useOrgHooks";
import {
  deriveOrgCampaignStatus,
  ORG_CAMPAIGN_STATUS_ORDER,
  type OrgCampaignStatus,
} from "../../utils/orgCampaignStatus";
import PageShell from "../../components/site/PageShell";
import { QueryStatePanel } from "../../components/ui/StatePanel";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { filterChipClass } from "../../components/ui/navItem";
import { LinkButton } from "../../components/forms/controls";

type FilterId = "all" | "accepted" | "applied" | "finished";

const FILTERS: {
  id: FilterId;
  label: string;
  statuses: readonly OrgCampaignStatus[];
}[] = [
  { id: "all", label: "All", statuses: ORG_CAMPAIGN_STATUS_ORDER },
  { id: "accepted", label: "Accepted", statuses: ["accepted", "active"] },
  { id: "applied", label: "Applied", statuses: ["applied"] },
  { id: "finished", label: "Finished", statuses: ["finished", "canceled"] },
];

function CampaignsHeader() {
  return (
    <PageHeader
      className="mb-10"
      kicker="Organization Portal"
      title="My campaigns"
      description="Track every drop you have applied to or been part of."
    />
  );
}

function ApiCampaigns() {
  const { data: items, isLoading, error } = useCampaigns();
  const [filter, setFilter] = useState<FilterId>("all");

  const rows = useMemo(() => {
    const campaigns = items ?? [];
    const mapped: { item: CampaignItem; status: OrgCampaignStatus }[] = [];
    for (const item of campaigns) {
      const status = deriveOrgCampaignStatus(item);
      if (status == null) continue;
      mapped.push({ item, status });
    }
    mapped.sort((a, b) => {
      const aRank = ORG_CAMPAIGN_STATUS_ORDER.indexOf(a.status);
      const bRank = ORG_CAMPAIGN_STATUS_ORDER.indexOf(b.status);
      if (aRank !== bRank) return aRank - bRank;
      return b.item.appliedAt - a.item.appliedAt;
    });
    return mapped;
  }, [items]);

  if (isLoading || error) {
    return (
      <PageShell width="wide">
        <CampaignsHeader />
        <QueryStatePanel
          isPending={isLoading}
          isError={Boolean(error)}
          label="campaigns"
        />
      </PageShell>
    );
  }

  if (rows.length === 0) {
    return (
      <PageShell width="wide">
        <CampaignsHeader />
        <EmptyState
          title="You have no campaigns yet."
          action={<LinkButton to="/org/browse">Browse campaigns</LinkButton>}
        >
          Apply to a drop and it shows up here.
        </EmptyState>
      </PageShell>
    );
  }

  const statuses = FILTERS.find((f) => f.id === filter)?.statuses ?? [];
  const visibleRows = rows.filter((row) => statuses.includes(row.status));

  return (
    <PageShell width="wide">
      <CampaignsHeader />
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
      {visibleRows.length === 0 ? (
        <EmptyState title="No campaigns match this filter." />
      ) : null}
      <div className="flex flex-col gap-3">
        {visibleRows.map(({ item, status }) => (
          <CampaignRow
            key={item.id}
            applicationId={item.id}
            brandName={item.brandName}
            title={item.title}
            image={item.image}
            status={status}
            shipments={item.shipments}
          />
        ))}
      </div>
    </PageShell>
  );
}

export default function OrgMyCampaignsPage() {
  return <ApiCampaigns />;
}
