/**
 * `/brand/dashboard` — Brand Aggregate Dashboard (PRODUCT.md §5.3.2).
 *
 * Renders from the real backend (GET /api/brands/me/aggregate,
 * /api/brands/me/drops, /api/brands/me/drop-requests,
 * /api/brands/me/engagement-series).
 */
import { useNavigate, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import AggregateTotalsCards from "../../components/brand/AggregateTotalsCards";
import ApiCompareDropsTable from "../../components/brand/ApiCompareDropsTable";
import EngagementOverTimeChart from "../../components/brand/EngagementOverTimeChart";
import RunningTotalsBar from "../../components/brand/RunningTotalsBar";
import {
  useBrandAggregate,
  useBrandDropRequests,
  useBrandDrops,
  useEngagementSeries,
  type BrandDropRequest,
} from "../../api/hooks/useBrandHooks";
import type { BrandAggregate, EngagementPoint } from "../../api/hooks/useBrandHooks";
import PageShell from "../../components/site/PageShell";
import { Button, SuccessBanner } from "../../components/forms/controls";
import { Card, CardHeader } from "../../components/ui/Card";
import { Chip } from "../../components/ui/Chip";
import { QueryStatePanel, StatePanel } from "../../components/ui/StatePanel";
import { STACK, TEXT, type Tone } from "../../theme/tokens";
import { cn } from "../../theme/cn";

function DashboardHeader({
  onPlanCampaign,
}: {
  onPlanCampaign: () => void;
}) {
  return (
    <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 className={TEXT.h1}>
          Brand <span className="text-buzz-coral">Dashboard</span>
        </h1>
        <p className={cn(TEXT.body, "mt-1 text-buzz-inkMuted")}>
          Aggregate performance across every drop you've run with Buzz.
        </p>
      </div>
      <Button
        type="button"
        onClick={onPlanCampaign}
        data-testid="plan-campaign"
      >
        <Sparkles size={16} /> Plan your Campaign
      </Button>
    </header>
  );
}

function statusTone(status: string): Tone {
  if (status === "converted") return "success";
  if (status === "closed") return "neutral";
  return "warn";
}

function StatusPill({ status }: { status: string }) {
  return <Chip tone={statusTone(status)}>{status.replace(/_/g, " ")}</Chip>;
}

function RequestsPanel({ tickets }: { tickets: BrandDropRequest[] }) {
  return (
    <Card kind="card" pad="none" className="scroll-mt-8 overflow-hidden" id="tickets">
      <div className="border-b border-buzz-line bg-buzz-cream px-6 py-4">
        <CardHeader
          title="Requests"
          description="Intake tickets — a representative will contact you."
          className="mb-0"
        />
      </div>
      {tickets.length === 0 ? (
        <p className={cn(TEXT.body, "px-6 py-8 text-buzz-inkMuted")}>
          No requests yet. Use Plan your Campaign to start a conversation.
        </p>
      ) : (
        <ul className="divide-y divide-buzz-lineMid">
          {tickets.map((ticket) => (
            <li
              key={ticket.id}
              className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-start sm:justify-between"
              data-testid="drop-request-row"
            >
              <div className="min-w-0 flex-1">
                <p className={cn(TEXT.body, "line-clamp-2 font-semibold text-buzz-ink")}>
                  {ticket.message}
                </p>
                <p className={cn(TEXT.meta, "mt-1")}>
                  A representative will contact you.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                <StatusPill status={ticket.status} />
                <span className={TEXT.meta}>
                  {new Date(ticket.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Map backend aggregate shape to what components expect. */
function mapAggregate(a: BrandAggregate) {
  return {
    brandId: "",
    totalDrops: a.totalDrops,
    totalPosts: a.totalPosts,
    totalLikes: a.totalLikes,
    totalComments: a.totalComments,
    totalEngagement: a.totalEngagement,
    totalReach: a.totalReach,
    totalOrgs: a.totalOrgs,
    totalCampuses: a.totalCampuses,
  };
}

function mapEngagementSeries(points: EngagementPoint[]) {
  return points.map((p) => ({
    timestamp: p.timestamp,
    engagement: p.engagement,
  }));
}

function ApiDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const ticketSubmitted = Boolean(
    (location.state as { ticketSubmitted?: boolean } | null)?.ticketSubmitted,
  );
  const planCampaign = () => navigate("/brand/requests/new");
  const { data: aggregate, isLoading: aggLoading, isError: aggError } =
    useBrandAggregate();
  const { data: drops, isLoading: dropsLoading, isError: dropsError } =
    useBrandDrops();
  const {
    data: requests,
    isLoading: requestsLoading,
    isError: requestsError,
  } = useBrandDropRequests();
  const { data: series, isLoading: seriesLoading, isError: seriesError } =
    useEngagementSeries();

  // Engagement series is chart-only — don't fail the whole dashboard if it errors.
  const isLoading = aggLoading || dropsLoading || requestsLoading;
  const isError = aggError || dropsError || requestsError;

  if (isLoading || isError) {
    return (
      <PageShell width="wide">
        <DashboardHeader onPlanCampaign={planCampaign} />
        <QueryStatePanel
          isPending={isLoading}
          isError={isError}
          label="dashboard"
        />
      </PageShell>
    );
  }

  const items = drops ?? [];
  const tickets = requests ?? [];
  const agg = aggregate ?? {
    totalDrops: 0,
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalEngagement: 0,
    totalReach: 0,
    totalOrgs: 0,
    totalCampuses: 0,
  };
  const pts = series ?? [];

  return (
    <PageShell width="wide">
      <DashboardHeader onPlanCampaign={planCampaign} />
      {ticketSubmitted ? (
        <div className="mb-6" data-testid="ticket-submitted-toast">
          <SuccessBanner>
            Request submitted. A representative will contact you.
          </SuccessBanner>
        </div>
      ) : null}
      <div className={STACK.section}>
        <RequestsPanel tickets={tickets} />
        {items.length === 0 ? (
          <StatePanel>
            No drops yet. After a representative builds your campaign and
            publishes it, performance will show up here.
          </StatePanel>
        ) : (
          <>
            <RunningTotalsBar metrics={mapAggregate(agg)} />
            <AggregateTotalsCards metrics={mapAggregate(agg)} />
            {seriesError ? (
              <StatePanel>
                Engagement over time is temporarily unavailable.
              </StatePanel>
            ) : seriesLoading ? (
              <StatePanel>Loading engagement chart…</StatePanel>
            ) : (
              <EngagementOverTimeChart points={mapEngagementSeries(pts)} />
            )}
            <ApiCompareDropsTable drops={items} />
          </>
        )}
      </div>
    </PageShell>
  );
}

export default function BrandAggregateDashboardPage() {
  return <ApiDashboard />;
}
