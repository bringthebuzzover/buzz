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

const PAGE_SHELL = "mx-auto max-w-6xl px-8 py-12";

function DashboardHeader({
  onPlanCampaign,
}: {
  onPlanCampaign: () => void;
}) {
  return (
    <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 className="text-3xl font-bold text-buzz-ink">Brand Dashboard</h1>
        <p className="mt-1 text-sm font-medium text-buzz-inkMuted">
          Aggregate performance across every drop you've run with Buzz.
        </p>
      </div>
      <button
        type="button"
        onClick={onPlanCampaign}
        data-testid="plan-campaign"
        className="flex items-center gap-2 rounded-lg bg-buzz-coral px-4 py-2 font-bold text-buzz-paper shadow-sm transition hover:bg-buzz-coralDark"
      >
        <Sparkles size={16} /> Plan your Campaign
      </button>
    </header>
  );
}

function statusTone(status: string): "good" | "warn" | "neutral" {
  if (status === "converted") return "good";
  if (status === "closed") return "neutral";
  return "warn";
}

function StatusPill({ status }: { status: string }) {
  const tone = statusTone(status);
  const toneClass =
    tone === "good"
      ? "border-green-200 bg-green-50 text-green-800"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-buzz-lineMid bg-buzz-cream text-buzz-inkMuted";
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${toneClass}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function RequestsPanel({ tickets }: { tickets: BrandDropRequest[] }) {
  return (
    <section
      id="tickets"
      className="scroll-mt-8 overflow-hidden rounded-2xl border border-buzz-lineMid bg-buzz-paper shadow-sm"
    >
      <div className="border-b border-buzz-line bg-buzz-cream px-6 py-4">
        <h3 className="text-lg font-bold text-buzz-ink">Requests</h3>
        <p className="mt-1 text-xs font-medium text-buzz-inkMuted">
          Intake tickets — a representative will contact you.
        </p>
      </div>
      {tickets.length === 0 ? (
        <p className="px-6 py-8 text-sm font-medium text-buzz-inkMuted">
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
                <p className="text-sm font-bold text-buzz-ink line-clamp-2">
                  {ticket.message}
                </p>
                <p className="mt-1 text-xs font-medium text-buzz-inkMuted">
                  A representative will contact you.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                <StatusPill status={ticket.status} />
                <span className="text-xs font-medium text-buzz-inkMuted">
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
    </section>
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

  if (isLoading) {
    return (
      <div className={PAGE_SHELL}>
        <DashboardHeader onPlanCampaign={planCampaign} />
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center text-sm font-medium text-buzz-inkMuted">
          Loading dashboard…
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={PAGE_SHELL}>
        <DashboardHeader onPlanCampaign={planCampaign} />
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center text-sm font-medium text-buzz-coral">
          Couldn’t load your dashboard. Please try again.
        </div>
      </div>
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
    <div className={PAGE_SHELL}>
      <DashboardHeader onPlanCampaign={planCampaign} />
      {ticketSubmitted ? (
        <div
          className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
          data-testid="ticket-submitted-toast"
        >
          Request submitted. A representative will contact you.
        </div>
      ) : null}
      <div className="space-y-8">
        <RequestsPanel tickets={tickets} />
        {items.length === 0 ? (
          <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center">
            <p className="text-sm font-medium text-buzz-inkMuted">
              No drops yet. After a representative builds your campaign and
              publishes it, performance will show up here.
            </p>
          </div>
        ) : (
          <>
            <RunningTotalsBar metrics={mapAggregate(agg)} />
            <AggregateTotalsCards metrics={mapAggregate(agg)} />
            {seriesError ? (
              <div className="rounded-2xl border border-dashed border-buzz-lineMid bg-buzz-cream p-8 text-center text-sm font-medium text-buzz-inkMuted">
                Engagement over time is temporarily unavailable.
              </div>
            ) : seriesLoading ? (
              <div className="rounded-2xl border border-dashed border-buzz-lineMid bg-buzz-cream p-8 text-center text-sm font-medium text-buzz-inkMuted">
                Loading engagement chart…
              </div>
            ) : (
              <EngagementOverTimeChart points={mapEngagementSeries(pts)} />
            )}
            <ApiCompareDropsTable drops={items} />
          </>
        )}
      </div>
    </div>
  );
}

export default function BrandAggregateDashboardPage() {
  return <ApiDashboard />;
}
