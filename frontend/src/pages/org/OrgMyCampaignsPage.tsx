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
import PageShell from "../../components/site/PageShell";
import { QueryStatePanel } from "../../components/ui/StatePanel";
import { STACK, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

function CampaignsHeader() {
  return (
    <header className="mb-8 text-center">
      <h1 className={TEXT.h1}>
        My <span className="text-buzz-coral">Campaigns</span>
      </h1>
      <p className={cn(TEXT.body, "mt-2 text-buzz-inkMuted")}>
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

  if (isLoading || error || rows.length === 0) {
    return (
      <PageShell width="portal">
        <CampaignsHeader />
        <QueryStatePanel
          isPending={isLoading}
          isError={Boolean(error)}
          isEmpty={!isLoading && !error && rows.length === 0}
          label="campaigns"
          empty="You have no campaigns yet. Browse Campaigns to apply to one."
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="portal">
      <CampaignsHeader />
      <div className={STACK.default}>
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
    </PageShell>
  );
}

export default function OrgMyCampaignsPage() {
  return <ApiCampaigns />;
}
