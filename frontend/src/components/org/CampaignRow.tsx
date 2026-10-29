/**
 * Single row in My Campaigns. Pen `Campaign / Row`: 72px thumb, brand, title,
 * tracking meta when Accepted, the status badge, and a chevron to the detail
 * page (`/org/campaigns/:applicationId`).
 */
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { OrgCampaignStatus } from "../../types/orgCampaign";
import { ORG_CAMPAIGN_STATUS_LABELS } from "../../types/orgCampaign";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { RemoteImage } from "../ui/RemoteImage";
import { TEXT, type Tone } from "../../theme/tokens";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";

type CampaignRowProps = {
  applicationId: string;
  brandName: string;
  title: string;
  image: string;
  status: OrgCampaignStatus;
  shipments?: { trackingNumber: string }[];
};

/** Pen badges: Applied is the yellow wash, Accepted paper with a dot, Finished and Canceled quiet. */
const STATUS_TONE: Record<OrgCampaignStatus, Tone> = {
  active: "success",
  accepted: "neutral",
  applied: "warn",
  finished: "neutral",
  canceled: "neutral",
};

export function CampaignStatusBadge({ status }: { status: OrgCampaignStatus }) {
  return (
    <Chip
      tone={STATUS_TONE[status]}
      dot={status !== "finished" && status !== "canceled"}
      className={status === "accepted" ? "text-primary" : undefined}
    >
      {ORG_CAMPAIGN_STATUS_LABELS[status]}
    </Chip>
  );
}

export default function CampaignRow({
  applicationId,
  brandName,
  title,
  image,
  status,
  shipments,
}: CampaignRowProps) {
  return (
    <Link
      to={`/org/campaigns/${applicationId}`}
      className={cn("block rounded-buzzBoard", focusRingClass)}
    >
      <Card
        kind="tile"
        pad="default"
        className="flex items-center gap-5 transition hover:border-primary"
      >
        <RemoteImage
          src={image}
          label={brandName}
          alt=""
          fallback="placeholder"
          className="h-[72px] w-[72px] shrink-0 rounded-buzzCard object-cover"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="truncate text-xs uppercase tracking-[0.05em] text-quiet">
            {brandName}
          </p>
          <h3 className="text-xl font-medium leading-tight text-primary">{title}</h3>
          {status === "accepted" && shipments && shipments.length > 0 ? (
            <p className={cn(TEXT.body, "text-muted")}>
              {shipments.length === 1
                ? `Tracking #${shipments[0].trackingNumber}`
                : `${shipments.length} tracking numbers`}
            </p>
          ) : null}
        </div>
        <CampaignStatusBadge status={status} />
        <ChevronRight size={18} className="shrink-0 text-quiet" aria-hidden />
      </Card>
    </Link>
  );
}
