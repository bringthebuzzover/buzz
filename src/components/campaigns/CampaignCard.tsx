/**
 * Summary tile for one campaign: hero image, brand pill, excerpt, meta row, and CTA `Link` to
 * `/campaigns/${campaign.id}` for full copy and apply flow.
 */
import { Link } from "react-router-dom";
import { Calendar, MapPin } from "lucide-react";
import type { Campaign } from "../../types/campaign";

type CampaignCardProps = {
  /** Campaign row from `CAMPAIGNS` to render. */
  campaign: Campaign;
};

export default function CampaignCard({ campaign }: CampaignCardProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-buzz-lineMid bg-buzz-butter shadow-sm transition hover:shadow-md">
      <div className="relative flex h-56 items-center justify-center overflow-hidden border-b border-buzz-lineMid">
        <img
          src={campaign.image}
          alt={campaign.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col bg-buzz-butter p-6">
        <div className="mb-2 flex items-start justify-between">
          <h3 className="pr-4 text-xl font-bold leading-tight text-buzz-coral">
            {campaign.title}
          </h3>
          <span className="whitespace-nowrap rounded-full border border-buzz-lineMid bg-buzz-paper px-3 py-1 text-[10px] font-bold text-buzz-ink">
            {campaign.brand}
          </span>
        </div>
        <p className="mb-6 line-clamp-3 flex-1 text-sm font-medium text-buzz-inkMuted">
          {campaign.description}
        </p>
        <div className="mb-6 flex items-center gap-4 text-xs font-bold text-buzz-inkMuted">
          <span className="flex items-center gap-1">
            <MapPin size={14} className="text-buzz-coral" />
            {campaign.location}
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={14} className="text-buzz-coral" />
            {campaign.date}
          </span>
        </div>
        <Link
          to={`/campaigns/${campaign.id}`}
          className="w-full rounded-lg bg-buzz-coral py-3 text-center font-semibold text-buzz-paper shadow-sm transition hover:bg-buzz-coralDark"
        >
          View Campaign & Apply
        </Link>
      </div>
    </div>
  );
}
