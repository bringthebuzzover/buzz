/**
 * Compact at-a-glance summary bar shown above the dashboard. Three highlighted
 * stats with subtle dividers; intentionally smaller than the totals cards.
 */
import { Activity, Eye, Heart } from "lucide-react";
import type { BrandAggregateMetrics } from "../../types/metrics";

type RunningTotalsBarProps = {
  metrics: BrandAggregateMetrics;
};

export default function RunningTotalsBar({ metrics }: RunningTotalsBarProps) {
  const items = [
    {
      icon: Activity,
      label: "Drops",
      value: metrics.totalDrops.toLocaleString(),
    },
    {
      icon: Heart,
      label: "Engagement",
      value: metrics.totalEngagement.toLocaleString(),
    },
    {
      icon: Eye,
      label: "Reach",
      value: metrics.totalReach.toLocaleString(),
    },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-buzz-lineMid bg-buzz-coral px-6 py-4 text-buzz-paper shadow-sm">
      {items.map(({ icon: Icon, label, value }, idx) => (
        <div
          key={label}
          className={`flex items-center gap-3 ${
            idx > 0 ? "border-l border-buzz-paper/30 pl-4" : ""
          }`}
        >
          <Icon size={18} />
          <div>
            <div className="text-xl font-black tabular-nums">{value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              {label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
