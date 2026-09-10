/**
 * Compact at-a-glance summary bar shown above the dashboard. Three highlighted
 * stats with subtle dividers; intentionally smaller than the totals cards.
 */
import { Activity, Eye, Heart } from "lucide-react";
import type { BrandAggregateMetrics } from "../../types/metrics";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

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
    <div className="grid grid-cols-3 divide-x divide-buzz-paper/30 rounded-buzzCard bg-buzz-coral px-2 py-4 text-buzz-paper shadow-buzz">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center justify-center gap-3 px-3">
          <Icon size={18} className="shrink-0" />
          <div>
            <div className={cn(TEXT.metric, "text-xl text-buzz-paper")}>
              {value}
            </div>
            <div className={cn(TEXT.micro, "opacity-80")}>{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
