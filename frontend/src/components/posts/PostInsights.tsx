/**
 * Compact Instagram insights row for one linked (or linkable) post.
 * Shared by the org campaign Linked posts card and the brand drop post list.
 */
import { STACK, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import { insightMetricsFor, type InsightSource } from "./postInsights";

type Props = {
  post: InsightSource;
};

export default function PostInsights({ post }: Props) {
  const metrics = insightMetricsFor(post);
  if (!metrics) return null;
  return (
    <div className={cn(STACK.tight, "mt-2")} data-testid="post-insights">
      <p className={cn(TEXT.micro, "text-buzz-coral")}>Instagram insights</p>
      <dl className="flex flex-wrap gap-x-4 gap-y-1">
        {metrics.map((metric) => (
          <div key={metric.key} className="flex items-baseline gap-1">
            <dt className={TEXT.meta}>{metric.label}</dt>
            <dd className="text-xs font-semibold tabular-nums text-buzz-ink">
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
