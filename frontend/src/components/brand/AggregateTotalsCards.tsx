/**
 * Pen KPI row for the brand dashboard: drops, engagement, reach, posts,
 * organizations, campuses (buzz-ops product/PRODUCT.md §5.3.2). Each total
 * appears once; there is no separate summary band.
 */
import type { BrandAggregateMetrics } from "../../types/metrics";
import { StatCard } from "../ui/Card";
import { GAP } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function AggregateTotalsCards({
  metrics,
}: {
  metrics: BrandAggregateMetrics;
}) {
  const tiles = [
    { label: "Drops", value: metrics.totalDrops },
    { label: "Engagement", value: metrics.totalEngagement },
    { label: "Reach", value: metrics.totalReach },
    { label: "Posts", value: metrics.totalPosts },
    { label: "Organizations", value: metrics.totalOrgs },
    { label: "Campuses", value: metrics.totalCampuses },
  ];
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6", GAP.default)}>
      {tiles.map(({ label, value }) => (
        <StatCard key={label} label={label} value={value.toLocaleString()} />
      ))}
    </div>
  );
}
