/**
 * `/org/campaigns` — My Campaigns (PRODUCT.md §6.4). Lists every campaign the
 * demo org is participating in with active-first sorting. Denied applications
 * are filtered out entirely (denials are email-only per spec).
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

export default function OrgMyCampaignsPage() {
  const drops = useDrops();
  const applications = useApplicationsForOrg(DEMO_ORG_ID);

  /** Join applications with their parent drop and derive visible status. */
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
    <div className="mx-auto max-w-4xl px-8 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-buzz-ink">
          My <span className="text-buzz-coral">Campaigns</span>
        </h1>
        <p className="mt-2 text-sm font-medium text-buzz-inkMuted">
          Track every drop you have applied to or been part of.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center text-sm font-medium text-buzz-inkMuted">
          You have no campaigns yet. Browse the Drop Feed to apply to one.
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
