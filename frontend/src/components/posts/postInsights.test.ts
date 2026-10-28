import {
  formatInsightCount,
  formatSkipRate,
  formatWatchMs,
  INSIGHT_MISSING,
  insightMetricsFor,
} from "./postInsights";

describe("formatInsightCount", () => {
  it("renders an em dash for missing values and zero as zero", () => {
    expect(formatInsightCount(null)).toBe(INSIGHT_MISSING);
    expect(formatInsightCount(undefined)).toBe(INSIGHT_MISSING);
    expect(formatInsightCount(Number.NaN)).toBe(INSIGHT_MISSING);
    expect(formatInsightCount(0)).toBe("0");
    expect(formatInsightCount(12400)).toBe("12,400");
  });
});

describe("formatWatchMs", () => {
  it("converts stored milliseconds into a duration", () => {
    expect(formatWatchMs(null)).toBe(INSIGHT_MISSING);
    expect(formatWatchMs(0)).toBe("0s");
    expect(formatWatchMs(1200)).toBe("1.2s");
    expect(formatWatchMs(48000)).toBe("48s");
    expect(formatWatchMs(125000)).toBe("2m 5s");
  });
});

describe("formatSkipRate", () => {
  it("renders Graph's percentage without scaling it again", () => {
    expect(formatSkipRate(null)).toBe(INSIGHT_MISSING);
    expect(formatSkipRate(undefined)).toBe(INSIGHT_MISSING);
    expect(formatSkipRate(Number.NaN)).toBe(INSIGHT_MISSING);
    expect(formatSkipRate(0)).toBe("0%");
    expect(formatSkipRate(0.4)).toBe("0.4%");
    expect(formatSkipRate(18.5)).toBe("18.5%");
    expect(formatSkipRate(37)).toBe("37%");
    // The live bug: 62.8 percentage points were shown as 6280%.
    expect(formatSkipRate(62.8)).toBe("62.8%");
    expect(formatSkipRate(100)).toBe("100%");
  });

  it("never renders a skip rate above 100%", () => {
    expect(formatSkipRate(100.04)).toBe("100%");
    expect(formatSkipRate(100.06)).toBe("100%");
    expect(formatSkipRate(6280)).toBe("100%");
    expect(formatSkipRate(-4)).toBe("0%");
  });
});

describe("insightMetricsFor", () => {
  it("lists feed insights and hides reel-only metrics", () => {
    const labels = insightMetricsFor({
      platform: "instagram",
      mediaProductType: "FEED",
      reach: 10,
      views: null,
      saved: 0,
    })?.map((metric) => metric.label);
    expect(labels).toEqual([
      "Reach",
      "Views",
      "Saves",
      "Shares",
      "Total interactions",
      "Profile visits",
      "Profile activity",
      "Follows",
    ]);
  });

  it("lists reel insights and hides profile metrics", () => {
    const metrics = insightMetricsFor({
      platform: "instagram",
      mediaProductType: "REELS",
      reach: 500,
      igReelsAvgWatchTime: 1200,
      reelsSkipRate: 62.8,
    });
    expect(metrics?.map((metric) => metric.label)).toEqual([
      "Reach",
      "Views",
      "Saves",
      "Shares",
      "Total interactions",
      "Avg watch time",
      "Total watch time",
      "Skip rate",
    ]);
    expect(metrics?.find((metric) => metric.key === "igReelsAvgWatchTime")?.value).toBe(
      "1.2s",
    );
    expect(metrics?.find((metric) => metric.key === "views")?.value).toBe(INSIGHT_MISSING);
    expect(metrics?.find((metric) => metric.key === "reelsSkipRate")?.value).toBe("62.8%");
  });

  it("skips non-Instagram posts", () => {
    expect(insightMetricsFor({ platform: "tiktok", reach: 10 })).toBeNull();
  });
});
