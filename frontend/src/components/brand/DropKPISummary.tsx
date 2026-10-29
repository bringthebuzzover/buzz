/**
 * Per-drop KPI tiles on the brand drop detail page: total engagement and
 * total reach. Cost per engagement is cut: there is no spend data.
 */
import type { DropAggregateMetrics } from "../../types/metrics";
import { StatCard } from "../ui/Card";
import { GAP } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function DropKPISummary({ metrics }: { metrics: DropAggregateMetrics }) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2", GAP.default)}>
      <StatCard
        label="Total engagement"
        value={(metrics.totalEngagement ?? 0).toLocaleString()}
      />
      <StatCard label="Total reach" value={(metrics.totalReach ?? 0).toLocaleString()} />
    </div>
  );
}
