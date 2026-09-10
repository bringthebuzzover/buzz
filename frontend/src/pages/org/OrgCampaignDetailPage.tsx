/**
 * `/org/campaigns/:campaignId` — per-status detail view.
 *
 * Renders from the real backend (GET /api/campaigns/:id + derived status).
 */
import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronLeft, ClipboardList, Truck } from "lucide-react";
import ApiPostSelector from "../../components/org/ApiPostSelector";
import { useCampaignDetail, useCampaignAggregate } from "../../api/hooks/useOrgHooks";
import { ApiError } from "../../api/errors";
import { BRAND_DROP_TRACKER_FULL_ORDER } from "../../types/brandPortal";
import {
  deriveOrgCampaignStatus,
  ORG_CAMPAIGN_STATUS_LABELS,
} from "../../utils/orgCampaignStatus";
import PageShell from "../../components/site/PageShell";
import { Card } from "../../components/ui/Card";
import { Chip } from "../../components/ui/Chip";
import { StatePanel } from "../../components/ui/StatePanel";
import { GAP, STACK, SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

function shipmentOnTheWay(detail: {
  trackingNumber: string | null;
  brandTrackerStage: string;
}): boolean {
  if (detail.trackingNumber) return true;
  const idx = BRAND_DROP_TRACKER_FULL_ORDER.indexOf(
    detail.brandTrackerStage as (typeof BRAND_DROP_TRACKER_FULL_ORDER)[number],
  );
  const awaitingIdx = BRAND_DROP_TRACKER_FULL_ORDER.indexOf("awaiting_products");
  return idx >= awaitingIdx && idx !== -1;
}

function ApiCampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: detail, isLoading, error } = useCampaignDetail(campaignId);
  const { data: aggregate } = useCampaignAggregate(campaignId);

  if (isLoading) {
    return (
      <PageShell width="portal">
        <StatePanel>Loading...</StatePanel>
      </PageShell>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return <Navigate to="/org/campaigns" replace />;
  }

  if (error || !detail) {
    return (
      <PageShell width="portal">
        <Link
          to="/org/campaigns"
          className="mb-6 flex items-center text-sm font-semibold text-buzz-inkMuted transition hover:text-buzz-coral"
        >
          <ChevronLeft size={16} className="mr-1" />
          Back to My Campaigns
        </Link>
        <StatePanel tone="danger">
          {error instanceof Error
            ? error.message
            : "Couldn’t load this campaign. Please try again."}
        </StatePanel>
      </PageShell>
    );
  }

  const status = deriveOrgCampaignStatus(detail);
  if (status == null) {
    return <Navigate to="/org/campaigns" replace />;
  }

  const agg = aggregate ?? {
    postCount: 0,
    likes: 0,
    comments: 0,
    engagement: 0,
    estimatedReach: 0,
  };
  const onTheWay = shipmentOnTheWay(detail);

  return (
    <PageShell width="portal">
      <Link
        to="/org/campaigns"
        className="mb-6 flex items-center text-sm font-semibold text-buzz-inkMuted transition hover:text-buzz-coral"
      >
        <ChevronLeft size={16} className="mr-1" />
        Back to My Campaigns
      </Link>

      <header className="mb-8">
        <div className={cn("mb-3 flex items-center", GAP.tight)}>
          <Chip accent>{detail.brandName}</Chip>
          <Chip>{ORG_CAMPAIGN_STATUS_LABELS[status]}</Chip>
        </div>
        <h1 className={TEXT.h1}>{detail.title}</h1>
        <p className={cn(TEXT.body, "mt-2 text-buzz-inkMuted")}>
          {detail.description ?? ""}
        </p>
      </header>

      {status === "applied" ? (
        <Card kind="card" pad="roomy">
          <div className="flex items-start gap-4">
            <ClipboardList size={28} className="mt-1 text-buzz-coral" />
            <div>
              <h2 className={cn(TEXT.h2, "mb-1")}>
                {detail.brandName} is reviewing your application
              </h2>
              <p className={cn(TEXT.body, "text-buzz-inkMuted")}>
                Submitted on{" "}
                {new Date(detail.appliedAt).toLocaleDateString()}. We will
                let you know once a decision has been made.
              </p>
              {detail.pitch ? (
                <blockquote className="mt-4 border-l-4 border-buzz-coral bg-buzz-cream p-4 text-sm font-medium italic text-buzz-inkMuted">
                  {detail.pitch}
                </blockquote>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {status === "accepted" ? (
        <Card kind="card" pad="roomy">
          <div className="flex items-start gap-4">
            <Truck size={28} className="mt-1 text-buzz-coral" />
            <div>
              <h2 className={cn(TEXT.h2, "mb-1")}>
                {onTheWay ? "Awaiting product" : "Accepted"}
              </h2>
              <p className={cn(TEXT.body, "text-buzz-inkMuted")}>
                {onTheWay
                  ? "You are accepted! Your shipment is on the way."
                  : "Accepted — awaiting shipping."}
              </p>
              {detail.trackingNumber ? (
                <div
                  className={cn(
                    SURFACE.inset,
                    "mt-4 inline-flex items-center gap-2 px-4 py-2",
                  )}
                >
                  <span className={cn(TEXT.micro, "text-buzz-inkMuted")}>
                    Tracking
                  </span>
                  <span className={cn(TEXT.body, "font-semibold text-buzz-ink")}>
                    #{detail.trackingNumber}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {status === "active" || status === "finished" ? (
        <div className={STACK.group}>
          <Card kind="card" pad="roomy">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="text-center">
                <p className={cn(TEXT.metric, "text-buzz-coral")}>{agg.postCount}</p>
                <p className={TEXT.meta}>Posts</p>
              </div>
              <div className="text-center">
                <p className={cn(TEXT.metric, "text-buzz-coral")}>{agg.likes}</p>
                <p className={TEXT.meta}>Likes</p>
              </div>
              <div className="text-center">
                <p className={cn(TEXT.metric, "text-buzz-coral")}>{agg.comments}</p>
                <p className={TEXT.meta}>Comments</p>
              </div>
              <div className="text-center">
                <p className={cn(TEXT.metric, "text-buzz-coral")}>{agg.estimatedReach}</p>
                <p className={TEXT.meta}>Est. Reach</p>
              </div>
            </div>
          </Card>
          {status === "finished" ? (
            <Card kind="card" pad="roomy">
              <h2 className={cn(TEXT.h2, "mb-2")}>Final results</h2>
              <p className={cn(TEXT.body, "text-buzz-inkMuted")}>
                This campaign has ended. Your linked posts are read-only — final
                metrics are shown above.
              </p>
            </Card>
          ) : null}
          <ApiPostSelector
            applicationId={detail.id}
            readOnly={status === "finished"}
          />
        </div>
      ) : null}
    </PageShell>
  );
}

export default function OrgCampaignDetailPage() {
  return <ApiCampaignDetail />;
}
