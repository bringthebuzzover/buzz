import { renderToString } from "react-dom/server";
import PostInsights from "./PostInsights";
import { INSIGHT_MISSING } from "./postInsights";

describe("PostInsights", () => {
  it("renders feed metrics with an em dash for values Graph did not store", () => {
    const html = renderToString(
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
    expect(html).toContain("Instagram insights");
    expect(html).toContain("Reach");
    expect(html).toContain("1,240");
    expect(html).toContain("Views");
    expect(html).toContain(INSIGHT_MISSING);
    expect(html).toContain("Saves");
    expect(html).toContain(">0<");
    expect(html).not.toContain("Avg watch time");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
  });

  it("renders nothing for a non-Instagram post", () => {
    const html = renderToString(
      <PostInsights post={{ platform: "tiktok", mediaProductType: "FEED", reach: 1 }} />,
    );
    expect(html).toBe("");
  });
});
