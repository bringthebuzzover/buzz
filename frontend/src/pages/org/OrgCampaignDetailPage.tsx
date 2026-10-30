/**
 * `/org/campaigns/:campaignId` — per-status detail view.
 *
 * Renders from the real backend (GET /api/campaigns/:id + derived status).
 */
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import ApiPostSelector from "../../components/org/ApiPostSelector";
import { CampaignStatusBadge } from "../../components/org/CampaignRow";
import {
  useCampaignAggregate,
  useCampaignDetail,
  type CampaignDetail,
  useSetCampaignDelivered,
  useWithdrawCampaign,
} from "../../api/hooks/useOrgHooks";
import { Button, ErrorBanner } from "../../components/forms/controls";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ApiError } from "../../api/errors";
import { SEATED_STATUSES, deriveOrgCampaignStatus } from "../../utils/orgCampaignStatus";
import type { SeatProgress } from "../../utils/dropStage";
import PageShell from "../../components/site/PageShell";
import { Card, CardHeader, StatCard } from "../../components/ui/Card";
import { BackLink, PageHeader } from "../../components/ui/PageHeader";
import { Loader } from "../../components/ui/EmptyState";
import { StatePanel } from "../../components/ui/StatePanel";
import { SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import ShipmentList from "../../components/shipments/ShipmentList";

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

/** Leave the drop. The API refuses once a package has shipped (BUZZ handles that). */
function WithdrawButton({ applicationId }: { applicationId: string }) {
  const withdraw = useWithdrawCampaign(applicationId);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="compact"
        data-testid="campaign-withdraw"
        onClick={() => setOpen(true)}
      >
        Withdraw
      </Button>
      {open ? (
        <ConfirmDialog
          title="Withdraw from this drop"
          description="Your seat goes back to the brand and the drop leaves My Campaigns. You can apply again while applications are open."
          confirmLabel="Withdraw"
          pendingLabel="Withdrawing…"
          destructive
          pending={withdraw.isPending}
          fallbackError="Could not withdraw."
          submitTestId="campaign-withdraw-confirm"
          onConfirm={async () => {
            await withdraw.mutateAsync(undefined);
            navigate("/org/campaigns", { replace: true });
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/** "I got it": the org confirms the product arrived; undo if tapped by mistake. */
function DeliveredControl({ detail }: { detail: CampaignDetail }) {
  const setDelivered = useSetCampaignDelivered(detail.id);
  const delivered = detail.deliveredAt != null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {delivered ? (
          <span className={cn(TEXT.body, "text-muted")} data-testid="campaign-delivered">
            Received {new Date(detail.deliveredAt as number).toLocaleDateString()}
          </span>
        ) : null}
        <Button
          type="button"
          variant={delivered ? "ghost" : "primary"}
          size="compact"
          data-testid="campaign-delivered-toggle"
          loading={setDelivered.isPending}
          onClick={() => setDelivered.mutate(!delivered)}
        >
          {delivered ? "Undo" : "I got it"}
        </Button>
      </div>
      {setDelivered.error ? (
        <ErrorBanner>{setDelivered.error.message}</ErrorBanner>
      ) : null}
    </div>
  );
}

const backLink = <BackLink to="/org/campaigns">Back to My Campaigns</BackLink>;

/** What the org reads at each step of its own seat (plan §3.3). */
const SEAT_COPY: Record<SeatProgress, { title: string; description: string }> = {
  accepted: { title: "Accepted", description: "Accepted — awaiting shipping." },
  shipped: {
    title: "On the way",
    description:
      "You are accepted! Your shipment is on the way. Once it arrives, mark it received and link a post or reel below.",
  },
  delivered: {
    title: "Delivered",
    description: "Your product arrived. Link a post or reel below.",
  },
  posted: {
    title: "Posted",
    description: "Your posts are linked. Metrics update below; link more any time.",
  },
};

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
  const shipments = detail.shipments ?? [];
  const onTheWay = shipments.length > 0;
  const seated = SEATED_STATUSES.includes(status);
  // Before anything ships the org may leave on its own; after, BUZZ ends the seat.
  const canWithdraw =
    status === "applied" || status === "under_review" || (seated && !onTheWay);
  const seatCopy = seated ? SEAT_COPY[status as SeatProgress] : null;

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
        actions={
          <div className="flex items-center gap-3">
            {canWithdraw ? <WithdrawButton applicationId={detail.id} /> : null}
            <CampaignStatusBadge status={status} />
          </div>
        }
      />

      {status === "canceled" ? (
        <Card kind="panel" pad="card">
          <CardHeader
            className="mb-0"
            title="This drop was canceled"
            description="BUZZ canceled this drop. Nothing more is needed from you; any posts you linked stay as they are."
          />
        </Card>
      ) : null}

      {status === "applied" || status === "under_review" ? (
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

      {seatCopy || status === "wrapped" ? (
        <>
          {seatCopy || onTheWay ? (
            <Card kind="panel" pad="card">
              <CardHeader
                className={onTheWay ? "mb-5" : "mb-0"}
                title={seatCopy?.title ?? "Shipments"}
                description={seatCopy?.description}
              />
              {onTheWay ? (
                <>
                  <p className="mb-3 text-xs text-quiet">Tracking</p>
                  <ShipmentList shipments={shipments} testId="org-campaign-shipments" />
                  {seated ? (
                    <div className="mt-5">
                      <DeliveredControl detail={detail} />
                    </div>
                  ) : null}
                </>
              ) : null}
            </Card>
          ) : null}
          <CampaignMetrics agg={agg} />
          {status === "wrapped" ? (
            <Card kind="panel" pad="card">
              <CardHeader
                className="mb-0"
                title="Final results"
                description={
                  detail.linksOpen
                    ? "This campaign has wrapped. You can still link late posts for a few weeks."
                    : "This campaign has ended. Your linked posts are read-only — final metrics are shown above."
                }
              />
            </Card>
          ) : null}
          <ApiPostSelector applicationId={detail.id} readOnly={!detail.linksOpen} />
        </>
      ) : null}
    </PageShell>
  );
}

export default function OrgCampaignDetailPage() {
  return <ApiCampaignDetail />;
}
