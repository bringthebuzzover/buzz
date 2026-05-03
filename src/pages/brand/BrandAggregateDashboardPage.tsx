/**
 * `/brand/dashboard` — Brand Aggregate Dashboard (PRODUCT.md §5.3.2). Composes
 * the running totals bar, totals cards, engagement-over-time chart, and the
 * sortable drop comparison table. Empty state when the brand has no drops.
 */
import { Link } from "react-router-dom";
import { useState } from "react";
import { PhoneCall, Plus } from "lucide-react";
import {
  useApplications,
  useBrandDrops,
  useLinks,
  usePosts,
} from "../../contexts/MockDataContext";
import { useDemoNow } from "../../contexts/DemoClockContext";
import {
  computeBrandAggregate,
  computeEngagementTimeSeries,
} from "../../utils/metrics";
import { DEMO_BRAND_ID } from "../../data/seed/seedBrands";
import { SEED_ORGS } from "../../data/seed/seedOrgs";
import AggregateTotalsCards from "../../components/brand/AggregateTotalsCards";
import CompareDropsTable from "../../components/brand/CompareDropsTable";
import EngagementOverTimeChart from "../../components/brand/EngagementOverTimeChart";
import RunningTotalsBar from "../../components/brand/RunningTotalsBar";
import StrategyCallModal from "../../components/site/modals/StrategyCallModal";

export default function BrandAggregateDashboardPage() {
  const [strategyOpen, setStrategyOpen] = useState(false);
  const drops = useBrandDrops(DEMO_BRAND_ID);
  const applications = useApplications();
  const links = useLinks();
  const posts = usePosts();
  const now = useDemoNow();

  const aggregate = computeBrandAggregate({
    brandId: DEMO_BRAND_ID,
    drops,
    applications,
    links,
    posts,
    orgs: SEED_ORGS,
  });

  const series = computeEngagementTimeSeries({
    brandId: DEMO_BRAND_ID,
    drops,
    links,
    posts,
    now,
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-12">
      <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-buzz-ink">Brand Dashboard</h1>
          <p className="mt-1 text-sm font-medium text-buzz-inkMuted">
            Aggregate performance across every drop you've run with Buzz.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStrategyOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-buzz-lineMid bg-buzz-paper px-4 py-2 font-bold text-buzz-inkMuted shadow-sm transition hover:bg-buzz-butter hover:text-buzz-coral"
          >
            <PhoneCall size={16} /> Schedule Strategy Call
          </button>
          <Link
            to="/brand/requests/new"
            className="flex items-center gap-2 rounded-lg bg-buzz-coral px-4 py-2 font-bold text-buzz-paper shadow-sm transition hover:bg-buzz-coralDark"
          >
            <Plus size={16} /> Request Drop
          </Link>
        </div>
      </header>

      {drops.length === 0 ? (
        <div className="rounded-2xl border border-buzz-lineMid bg-buzz-cream p-12 text-center">
          <p className="text-sm font-medium text-buzz-inkMuted">
            No drops yet. Request your first drop to see analytics.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <RunningTotalsBar metrics={aggregate} />
          <AggregateTotalsCards metrics={aggregate} />
          <EngagementOverTimeChart points={series} />
          <CompareDropsTable
            drops={drops}
            applications={applications}
            links={links}
            posts={posts}
            orgs={SEED_ORGS}
          />
        </div>
      )}
      {strategyOpen ? (
        <StrategyCallModal onClose={() => setStrategyOpen(false)} />
      ) : null}
    </div>
  );
}
