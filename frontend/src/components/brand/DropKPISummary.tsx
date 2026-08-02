/**
 * KPI summary card cluster for the brand-side per-drop view. Three tiles:
 * total engagement, total reach, and cost-per-engagement (`N/A` in v1 since
 * no cost inputs exist in the mock store).
 */
import { DollarSign, Eye, Heart } from "lucide-react";
import type { DropAggregateMetrics } from "../../types/metrics";

type DropKPISummaryProps = {
  metrics: DropAggregateMetrics;
};

export default function DropKPISummary({ metrics }: DropKPISummaryProps) {
  const tiles = [
    {
      icon: Heart,
      label: "Total engagement",
      value: metrics.totalEngagement.toLocaleString(),
    },
    {
      icon: Eye,
      label: "Total reach",
      value: metrics.totalReach.toLocaleString(),
    },
    {
      icon: DollarSign,
      label: "Cost per engagement",
      value:
        metrics.costPerEngagement == null
          ? "N/A"
          : `$${metrics.costPerEngagement.toFixed(2)}`,
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {tiles.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="rounded-2xl border border-buzz-lineMid bg-buzz-butter p-6 text-center shadow-sm"
        >
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-buzz-paper">
            <Icon size={20} className="text-buzz-coral" />
          </div>
          <div className="text-3xl font-black tabular-nums text-buzz-ink">
            {value}
          </div>
          <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-buzz-inkMuted">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
