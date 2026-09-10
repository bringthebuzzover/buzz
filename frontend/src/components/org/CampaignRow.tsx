/**
 * Single row in My Campaigns. Shows a status badge, the parent drop's title and
 * brand, the org campaign's tracking number when Accepted, and links to the
 * detail page (`/org/campaigns/:applicationId`).
 */
import { Link } from "react-router-dom";
import { ChevronRight, Truck } from "lucide-react";
import type { OrgCampaignStatus } from "../../types/orgCampaign";
import { ORG_CAMPAIGN_STATUS_LABELS } from "../../types/orgCampaign";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { TEXT, type Tone } from "../../theme/tokens";
import { cn } from "../../theme/cn";

type CampaignRowProps = {
  applicationId: string;
  brandName: string;
  title: string;
  image: string;
  status: OrgCampaignStatus;
  trackingNumber?: string | null;
};

const STATUS_TONE: Record<OrgCampaignStatus, Tone> = {
  active: "success",
  accepted: "warn",
  applied: "neutral",
  finished: "neutral",
};

export default function CampaignRow({
  applicationId,
  brandName,
  title,
  image,
  status,
  trackingNumber,
}: CampaignRowProps) {
  return (
    <Link to={`/org/campaigns/${applicationId}`} className="block">
      <Card
        kind="card"
        pad="default"
        className="flex items-center justify-between gap-4 transition hover:shadow-buzzLg"
      >
        <div className="flex min-w-0 items-center gap-4">
          <img
            src={image}
            alt=""
            className="h-16 w-16 shrink-0 rounded-buzzControl border border-buzz-lineMid object-cover"
          />
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 overflow-hidden">
              <Chip tone={STATUS_TONE[status]}>
                {ORG_CAMPAIGN_STATUS_LABELS[status]}
              </Chip>
              <Chip accent>{brandName}</Chip>
            </div>
            <h3 className={TEXT.h3}>{title}</h3>
            {status === "accepted" && trackingNumber ? (
              <p className={cn(TEXT.meta, "mt-1 flex items-center gap-1")}>
                <Truck size={12} className="text-buzz-coral" />
                Tracking #{trackingNumber}
              </p>
            ) : null}
          </div>
        </div>
        <ChevronRight size={20} className="shrink-0 text-buzz-inkFaint" />
      </Card>
    </Link>
  );
}
