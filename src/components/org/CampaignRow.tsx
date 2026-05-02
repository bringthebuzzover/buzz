/**
 * Single row in My Campaigns. Shows a status badge, the parent drop's title and
 * brand, the org campaign's tracking number when Accepted, and links to the
 * detail page (`/org/campaigns/:applicationId`).
 */
import { Link } from "react-router-dom";
import { ChevronRight, Truck } from "lucide-react";
import type { Drop } from "../../types/drop";
import type {
  DropApplication,
  OrgCampaignStatus,
} from "../../types/orgCampaign";
import { ORG_CAMPAIGN_STATUS_LABELS } from "../../types/orgCampaign";

type CampaignRowProps = {
  application: DropApplication;
  drop: Drop;
  status: OrgCampaignStatus;
};

const STATUS_TONE: Record<OrgCampaignStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  accepted: "bg-buzz-butter text-buzz-ink",
  waitlisted: "bg-amber-100 text-amber-800",
  applied: "bg-buzz-cream text-buzz-inkMuted",
  finished: "bg-slate-100 text-slate-700",
};

export default function CampaignRow({
  application,
  drop,
  status,
}: CampaignRowProps) {
  return (
    <Link
      to={`/org/campaigns/${application.id}`}
      className="flex items-center justify-between gap-4 rounded-2xl border border-buzz-lineMid bg-buzz-paper p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-center gap-4">
        <img
          src={drop.image}
          alt=""
          className="h-16 w-16 rounded-xl border border-buzz-lineMid object-cover"
        />
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[status]}`}
            >
              {ORG_CAMPAIGN_STATUS_LABELS[status]}
            </span>
            <span className="rounded-full border border-buzz-lineMid bg-buzz-cream px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-buzz-coral">
              {drop.brandName}
            </span>
          </div>
          <h3 className="text-lg font-bold text-buzz-ink">{drop.title}</h3>
          {status === "accepted" && application.trackingNumber ? (
            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-buzz-inkMuted">
              <Truck size={12} className="text-buzz-coral" />
              Tracking #{application.trackingNumber}
            </p>
          ) : null}
        </div>
      </div>
      <ChevronRight size={20} className="text-buzz-inkFaint" />
    </Link>
  );
}
