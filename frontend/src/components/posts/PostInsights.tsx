/**
 * Compact Instagram insights row for one linked (or linkable) post.
 * Shared by the org campaign Linked posts card and the brand drop post list.
 * Pen `Post / Card` insights: quiet label, then a KV grid that fills its width.
 */
import { insightMetricsFor, type InsightSource } from "./postInsights";

type Props = {
  post: InsightSource;
};

export default function PostInsights({ post }: Props) {
  const metrics = insightMetricsFor(post);
  if (!metrics) return null;
  return (
    <div className="mt-4 flex flex-col gap-3" data-testid="post-insights">
      <p className="text-xs tracking-[0.03em] text-quiet">Instagram insights</p>
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
        {metrics.map((metric) => (
          <div key={metric.key}>
            <dt className="text-xs text-quiet">{metric.label}</dt>
            <dd className="mt-1 text-sm tabular-nums text-primary">{metric.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
