/**
 * Active campaigns index: page title and a responsive two-column grid of `CampaignCard`
 * (entry point before `/campaigns/:id`).
 */
import CampaignCard from "../../components/campaigns/CampaignCard";
import { CAMPAIGNS } from "../../data/campaigns";

export default function CampaignsPage() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      <div className="mb-12 text-center">
        <h2 className="mb-2 text-3xl font-bold text-buzz-ink">
          Active <span className="text-buzz-coral">Campaigns</span>
        </h2>
        <p className="text-sm font-medium text-buzz-inkMuted">
          Apply to host pop-ups and receive PR from these brands
        </p>
      </div>

      <div className="mb-20 grid grid-cols-1 gap-8 md:grid-cols-2">
        {CAMPAIGNS.map(camp => (
          <CampaignCard key={camp.id} campaign={camp} />
        ))}
      </div>
    </div>
  );
}
