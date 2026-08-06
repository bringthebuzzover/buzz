/**
 * `/org/campaigns` — My Campaigns (PRODUCT.md §6.4).
 *
 * Renders from the real backend (GET /api/campaigns).
 */
import { useMemo } from "react";
import CampaignRow from "../../components/org/CampaignRow";
import { useCampaigns } from "../../api/hooks/useOrgHooks";
import type { CampaignItem } from "../../api/hooks/useOrgHooks";
import {
  deriveOrgCampaignStatus,
  ORG_CAMPAIGN_STATUS_ORDER,
  type OrgCampaignStatus,
} from "../../utils/orgCampaignStatus";

const PAGE_SHELL = "mx-auto max-w-4xl px-8 py-12";

function CampaignsHeader() {
  return (
    <header className="mb-8 text-center">
      <h1 className="text-3xl font-bold text-buzz-ink">
        My <span className="text-buzz-coral">Campaigns</span>
      </h1>
      <p className="mt-2 text-sm font-medium text-buzz-inkMuted">
        Track every drop you have applied to or been part of.
      </p>
    </header>
  );
}

function ApiCampaigns() {
  const { data: items, isLoading, error } = useCampaigns();

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

  if (isLoading) {
    return (
      <div className={PAGE_SHELL}>
        <CampaignsHeader />
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center text-sm font-medium text-buzz-inkMuted">
          Loading campaigns…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={PAGE_SHELL}>
        <CampaignsHeader />
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center text-sm font-medium text-buzz-coral">
          Couldn't load campaigns. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL}>
      <CampaignsHeader />
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center text-sm font-medium text-buzz-inkMuted">
          You have no campaigns yet. Browse Campaigns to apply to one.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map(({ item, status }) => (
            <CampaignRow
              key={item.id}
              applicationId={item.id}
              brandName={item.brandName}
              title={item.title}
              image={item.image}
              status={status}
              trackingNumber={item.trackingNumber}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgMyCampaignsPage() {
  return <ApiCampaigns />;
}
