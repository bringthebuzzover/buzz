/**
 * `/org/campaigns/:campaignId` — per-status detail view.
 *
 * Renders from the real backend (GET /api/campaigns/:id + derived status).
 */
import { Navigate, useParams } from "react-router-dom";
import ApiPostSelector from "../../components/org/ApiPostSelector";
import { CampaignStatusBadge } from "../../components/org/CampaignRow";
import { useCampaignDetail, useCampaignAggregate } from "../../api/hooks/useOrgHooks";
import { ApiError } from "../../api/errors";
import { BRAND_DROP_TRACKER_FULL_ORDER } from "../../types/brandPortal";
import { deriveOrgCampaignStatus } from "../../utils/orgCampaignStatus";
import PageShell from "../../components/site/PageShell";
import { Card, CardHeader, StatCard } from "../../components/ui/Card";
import { BackLink, PageHeader } from "../../components/ui/PageHeader";
import { Loader } from "../../components/ui/EmptyState";
import { StatePanel } from "../../components/ui/StatePanel";
import { SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import ShipmentList from "../../components/shipments/ShipmentList";
import type { Shipment } from "../../utils/shipments";

/** Pen `Stat` row: Posts, Likes, Comments, Instagram Reach. */
function CampaignMetrics({
  agg,
}: {
  agg: {
    postCount: number;
    likes: number;
    comments: number;
    estimatedReach: number;
  };
}) {
  const stats = [
    { label: "Posts", value: agg.postCount },
    { label: "Likes", value: agg.likes },
    { label: "Comments", value: agg.comments },
    { label: "Instagram Reach", value: agg.estimatedReach },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((stat) => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value.toLocaleString()}
        />
      ))}
    </div>
  );
}

const backLink = <BackLink to="/org/campaigns">Back to My Campaigns</BackLink>;

function shipmentOnTheWay(detail: {
  shipments?: Shipment[];
  brandTrackerStage: string;
}): boolean {
  if ((detail.shipments ?? []).length > 0) return true;
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
      <PageShell width="wide">
        <Loader className="py-16" />
      </PageShell>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return <Navigate to="/org/campaigns" replace />;
  }

  if (error || !detail) {
    return (
      <PageShell width="wide">
        <div className="mb-6">{backLink}</div>
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

  const shipments = detail.shipments ?? [];

  return (
    <PageShell width="wide" className="flex flex-col gap-10">
      <PageHeader
        className="mb-0"
        back={backLink}
        kicker={
          <span className="uppercase tracking-[0.05em] text-quiet">
            {detail.brandName}
          </span>
        }
        title={detail.title}
        description={detail.description ?? ""}
        actions={<CampaignStatusBadge status={status} />}
      />

      {status === "applied" ? (
        <Card kind="panel" pad="card">
          <CardHeader
            className="mb-5"
            title={`${detail.brandName} is reviewing your application`}
            description={`Submitted on ${new Date(detail.appliedAt).toLocaleDateString()}. We will let you know once a decision has been made.`}
          />
          {detail.pitch ? (
            <blockquote className={cn(SURFACE.inset, TEXT.body, "p-4 text-muted")}>
              {detail.pitch}
            </blockquote>
          ) : null}
        </Card>
      ) : null}

      {status === "accepted" ? (
        <>
          <Card kind="panel" pad="card">
            <CardHeader
              className={shipments.length > 0 ? "mb-5" : "mb-0"}
              title={onTheWay ? "Awaiting product" : "Accepted"}
              description={
                <>
                  {onTheWay
                    ? "You are accepted! Your shipment is on the way."
                    : "Accepted — awaiting shipping."}
                  {detail.brandTrackerStage === "awaiting_products"
                    ? " If the product already arrived, link a post or reel below."
                    : null}
                </>
              }
            />
            {shipments.length > 0 ? (
              <>
                <p className="mb-3 text-xs text-quiet">Tracking</p>
                <ShipmentList shipments={shipments} testId="org-campaign-shipments" />
              </>
            ) : null}
          </Card>
          {detail.brandTrackerStage === "awaiting_products" ? (
            <>
              <CampaignMetrics agg={agg} />
              <ApiPostSelector applicationId={detail.id} />
            </>
          ) : null}
        </>
      ) : null}

      {status === "active" || status === "finished" ? (
        <>
          {shipments.length > 0 ? (
            <Card kind="panel" pad="card">
              <CardHeader className="mb-5" title="Shipments" />
              <ShipmentList shipments={shipments} testId="org-campaign-shipments" />
            </Card>
          ) : null}
          <CampaignMetrics agg={agg} />
          {status === "finished" ? (
            <Card kind="panel" pad="card">
              <CardHeader
                className="mb-0"
                title="Final results"
                description="This campaign has ended. Your linked posts are read-only — final metrics are shown above."
              />
            </Card>
          ) : null}
          <ApiPostSelector applicationId={detail.id} readOnly={status === "finished"} />
        </>
      ) : null}
    </PageShell>
  );
}

export default function OrgCampaignDetailPage() {
  return <ApiCampaignDetail />;
}
