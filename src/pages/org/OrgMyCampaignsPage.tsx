/**
 * `/org/campaigns` — My Campaigns (PRODUCT.md §6.4).
 *
 * Stage 6 (strangler): behind USE_API this page renders from the real backend
 * (GET /api/campaigns). With the flag off it keeps the original demo behavior.
 */
import { useMemo } from "react";
import CampaignRow from "../../components/org/CampaignRow";
import {
  useApplicationsForOrg,
  useDrops,
} from "../../contexts/MockDataContext";
import { ORG_CAMPAIGN_STATUS_ORDER } from "../../types/orgCampaign";
import { deriveOrgCampaignStatus } from "../../utils/orgCampaignStatus";
import { DEMO_ORG_ID } from "../../data/seed/seedOrgs";
import { USE_API } from "../../config/featureFlags";
import { useCampaigns } from "../../api/hooks/useOrgHooks";
import type { CampaignItem } from "../../api/hooks/useOrgHooks";

/** Derive org-campaign status from a backend CampaignItem. */
function deriveApiStatus(item: CampaignItem) {
  const stage = item.brandTrackerStage;
  const decision = item.decision;

  if (decision === "denied") return null;
  if (decision === "applied") return "applied" as const;
  if (decision === "accepted") {
    // accepted but drop not yet active → "accepted"
    if (stage === "request_received" || stage === "finalizing_agreements" || stage === "awaiting_products") {
      return "accepted" as const;
    }
    // drop is active → "active"
    if (stage === "drop_active") return "active" as const;
    // drop finished → "finished"
    if (stage === "drop_finished") return "finished" as const;
    return "accepted" as const;
  }
  // "waitlisted" decision — backend doesn't have this, but handle gracefully
  return null;
}

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

/** Demo path: localStorage stores. */
function DemoCampaigns() {
  const drops = useDrops();
  const applications = useApplicationsForOrg(DEMO_ORG_ID);

  const rows = useMemo(() => {
    const dropById = new Map(drops.map((d) => [d.id, d]));
    return applications
      .map((application) => {
        const drop = dropById.get(application.dropId);
        if (!drop) return null;
        const status = deriveOrgCampaignStatus(application, drop);
        if (status == null) return null;
        return { application, drop, status };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => {
        const aRank = ORG_CAMPAIGN_STATUS_ORDER.indexOf(a.status);
        const bRank = ORG_CAMPAIGN_STATUS_ORDER.indexOf(b.status);
        if (aRank !== bRank) return aRank - bRank;
        return b.application.appliedAt - a.application.appliedAt;
      });
  }, [applications, drops]);

  return (
    <div className={PAGE_SHELL}>
      <CampaignsHeader />
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center text-sm font-medium text-buzz-inkMuted">
          You have no campaigns yet. Browse Campaigns to apply to one.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map(({ application, drop, status }) => (
            <CampaignRow
              key={application.id}
              application={application}
              drop={drop}
              status={status}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** API path: GET /api/campaigns. */
function ApiCampaigns() {
  const { data: items, isLoading, error } = useCampaigns();

  const rows = useMemo(() => {
    const campaigns = items ?? [];
    const mapped: { item: CampaignItem; status: NonNullable<ReturnType<typeof deriveApiStatus>> }[] = [];
    for (const item of campaigns) {
      const status = deriveApiStatus(item);
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

  const mappedRows = rows.map(({ item, status }: { item: CampaignItem; status: NonNullable<ReturnType<typeof deriveApiStatus>> }) => ({
    application: {
      id: item.id,
      dropId: item.dropId,
      orgId: "",
      decision: item.decision as "applied" | "accepted" | "denied" | "waitlisted",
      appliedAt: item.appliedAt,
      decisionAt: item.decisionAt,
      pitch: item.pitch ?? undefined,
      trackingNumber: item.trackingNumber ?? undefined,
      allocatedUnits: item.allocatedUnits ?? undefined,
    },
    drop: {
      id: item.dropId,
      brandId: "",
      brandName: item.brandName,
      title: item.title,
      description: "",
      image: item.image,
      location: "",
      capacityTotal: 0,
      applyOpenAt: 0,
      applyCloseAt: 0,
      manualReopen: false,
      brandTrackerStage: item.brandTrackerStage,
      createdAt: 0,
    },
    status,
  }));

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
      {mappedRows.length === 0 ? (
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center text-sm font-medium text-buzz-inkMuted">
          You have no campaigns yet. Browse Campaigns to apply to one.
        </div>
      ) : (
        <div className="space-y-4">
          {mappedRows.map(({ application, drop, status }: { application: any; drop: any; status: any }) => (
            <CampaignRow
              key={application.id}
              application={application}
              drop={drop}
              status={status}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgMyCampaignsPage() {
  return USE_API ? <ApiCampaigns /> : <DemoCampaigns />;
}
