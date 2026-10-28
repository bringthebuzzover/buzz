/**
 * Labels and display values for Instagram media insights already stored on a post.
 *
 * Metric names match what `fetch_media_insights` requests. Feed-only and
 * reel-only metrics are omitted on the other media type, because Graph is
 * never asked for them there. Null means the value was not stored (omitted
 * or not synced yet) and renders as an em dash. Zero is a real count.
 */

export const INSIGHT_MISSING = "\u2014";

export type InsightSource = {
  platform?: string | null;
  mediaProductType?: string | null;
  reach?: number | null;
  views?: number | null;
  saved?: number | null;
  shares?: number | null;
  totalInteractions?: number | null;
  profileVisits?: number | null;
  profileActivity?: number | null;
  follows?: number | null;
  igReelsAvgWatchTime?: number | null;
  igReelsVideoViewTotalTime?: number | null;
  reelsSkipRate?: number | null;
};

export type InsightMetric = {
  key: string;
  label: string;
  value: string;
};

export function formatInsightCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return INSIGHT_MISSING;
  return Math.round(value).toLocaleString("en-US");
}

/** Graph returns reel watch times in milliseconds. */
export function formatWatchMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return INSIGHT_MISSING;
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    const rounded = Math.round(totalSeconds * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  let seconds = Math.round(totalSeconds % 60);
  let wholeMinutes = minutes;
  if (seconds === 60) {
    wholeMinutes += 1;
    seconds = 0;
  }
  return `${wholeMinutes}m ${seconds}s`;
}

/**
 * `reels_skip_rate` is a percentage in [0, 100] (62.8 → "62.8%").
 * Graph already returns percentage points; multiplying by 100 again
 * rendered values such as 6280%. Out-of-range numbers are clamped.
 */
export function formatSkipRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return INSIGHT_MISSING;
  const rounded = Math.round(rate * 10) / 10;
  const pct = Math.min(100, Math.max(0, rounded));
  const text = Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1);
  return `${text}%`;
}

export function insightMetricsFor(post: InsightSource): InsightMetric[] | null {
  if (post.platform != null && post.platform !== "instagram") return null;
  const reel = post.mediaProductType === "REELS";
  const metrics: InsightMetric[] = [
    { key: "reach", label: "Reach", value: formatInsightCount(post.reach) },
    { key: "views", label: "Views", value: formatInsightCount(post.views) },
    { key: "saved", label: "Saves", value: formatInsightCount(post.saved) },
    { key: "shares", label: "Shares", value: formatInsightCount(post.shares) },
    {
      key: "totalInteractions",
      label: "Total interactions",
      value: formatInsightCount(post.totalInteractions),
    },
  ];
  if (reel) {
    metrics.push(
      {
        key: "igReelsAvgWatchTime",
        label: "Avg watch time",
        value: formatWatchMs(post.igReelsAvgWatchTime),
      },
      {
        key: "igReelsVideoViewTotalTime",
        label: "Total watch time",
        value: formatWatchMs(post.igReelsVideoViewTotalTime),
      },
      {
        key: "reelsSkipRate",
        label: "Skip rate",
        value: formatSkipRate(post.reelsSkipRate),
      },
    );
  } else {
    metrics.push(
      {
        key: "profileVisits",
        label: "Profile visits",
        value: formatInsightCount(post.profileVisits),
      },
      {
        key: "profileActivity",
        label: "Profile activity",
        value: formatInsightCount(post.profileActivity),
      },
      { key: "follows", label: "Follows", value: formatInsightCount(post.follows) },
    );
  }
  return metrics;
}
