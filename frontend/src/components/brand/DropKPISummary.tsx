/**
 * KPI summary card cluster for the brand-side per-drop view. Three tiles:
 * total engagement, total reach, and cost-per-engagement (`N/A` in v1 since
 * no cost inputs exist in the mock store).
 */
import { DollarSign, Eye, Heart } from "lucide-react";
import type { DropAggregateMetrics } from "../../types/metrics";
import { Card } from "../ui/Card";
import { GAP, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

type DropKPISummaryProps = {
  metrics: DropAggregateMetrics;
};

export default function DropKPISummary({ metrics }: DropKPISummaryProps) {
  const tiles = [
    {
      icon: Heart,
      label: "Total engagement",
      value: (metrics.totalEngagement ?? 0).toLocaleString(),
    },
    {
      icon: Eye,
      label: "Total reach",
      value: (metrics.totalReach ?? 0).toLocaleString(),
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
    <div className={cn("grid grid-cols-1 sm:grid-cols-3", GAP.default)}>
      {tiles.map(({ icon: Icon, label, value }) => (
        <Card key={label} kind="cardWarm" pad="card" className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-buzz-paper">
            <Icon size={20} className="text-buzz-coral" />
          </div>
          <div className={TEXT.metric}>{value}</div>
          <div className={cn(TEXT.micro, "mt-2 text-buzz-inkMuted")}>{label}</div>
        </Card>
      ))}
    </div>
  );
}
