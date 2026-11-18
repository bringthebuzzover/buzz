import { renderToString } from "react-dom/server";
import PostInsights from "./PostInsights";
import { INSIGHT_MISSING } from "./insightMetrics";

describe("PostInsights", () => {
  it("renders feed metrics with an em dash for values Graph did not store", () => {
    const view = renderToString(
      <PostInsights
        post={{
          platform: "instagram",
          mediaProductType: "FEED",
          reach: 1240,
          views: null,
          saved: 0,
          shares: 18,
          totalInteractions: 88,
          profileVisits: 12,
          profileActivity: null,
          follows: 2,
        }}
      />,
    );
    expect(view).toContain("Instagram insights");
    expect(view).toContain("Reach");
    expect(view).toContain("1,240");
    expect(view).toContain("Views");
    expect(view).toContain(INSIGHT_MISSING);
    expect(view).toContain("Saves");
    expect(view).toContain(">0<");
    expect(view).not.toContain("Avg watch time");
    expect(view).not.toContain("undefined");
    expect(view).not.toContain("NaN");
  });

  it("renders nothing for a non-Instagram post", () => {
    const view = renderToString(
      <PostInsights post={{ platform: "tiktok", mediaProductType: "FEED", reach: 1 }} />,
    );
    expect(view).toBe("");
  });
});
