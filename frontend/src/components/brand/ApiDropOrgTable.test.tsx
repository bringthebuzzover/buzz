/**
 * An erased org stays on the participant list as an anonymized frozen row.
 * A live org still shows its linked post and insights.
 */
import { renderToString } from "react-dom/server";
import ApiDropOrgTable from "./ApiDropOrgTable";
import type { BrandDropApplicant, BrandDropPost } from "../../api/hooks/useBrandHooks";
import { INSIGHT_MISSING } from "../posts/postInsights";

const erased: BrandDropApplicant = {
  id: "app-1",
  dropId: "drop-1",
  orgId: "org-1",
  orgName: "Deleted organization",
  university: "",
  metricsFrozenAt: Date.UTC(2026, 9, 28),
  instagramHandle: "",
  category: null,
  followerCount: 100,
  memberCount: 40,
  pitch: null,
  decision: "accepted",
  decisionAt: Date.now(),
  appliedAt: Date.now(),
  allocatedUnits: null,
  deliveryAddress: null,
  accountErased: true,
  shipments: [],
  attributedComments: 0,
  attributedEngagement: 0,
  attributedLikes: 0,
  attributedPostCount: 0,
  posts: [],
};

const linkedPost: BrandDropPost = {
  id: "post-1",
  url: "https://instagram.com/p/example",
  mediaUrl: null,
  thumbnailUrl: null,
  caption: "Morning workout fuel",
  mediaType: "IMAGE",
  mediaProductType: "FEED",
  postedAt: 1,
  likes: 410,
  comments: 22,
  platform: "instagram",
  reach: 900,
  views: null,
  saved: 7,
  shares: 0,
  totalInteractions: 30,
  profileVisits: 4,
  profileActivity: 1,
  follows: null,
  igReelsAvgWatchTime: null,
  igReelsVideoViewTotalTime: null,
  reelsSkipRate: null,
};

describe("ApiDropOrgTable", () => {
  it("shows an erased org as a frozen anonymized participant", () => {
    const html = renderToString(
      <ApiDropOrgTable applicants={[erased]} />,
    );
    expect(html).toContain("Deleted organization");
    expect(html).toContain("Metrics frozen");
    expect(html).not.toContain("Cornell University");
    expect(html).not.toContain("Ship to");
    expect(html).not.toContain("Account deleted");
  });

  it("keeps a missing address as Address pending in the warn tone", () => {
    const html = renderToString(
      <ApiDropOrgTable
        applicants={[{ ...erased, accountErased: false, orgName: "Campus Club" }]}
      />,
    );
    expect(html).toContain("Ship to");
    expect(html).toMatch(
      /<span data-testid="address-pending" class="[^"]*text-accent[^"]*">Address pending<\/span>/,
    );
  });

  it("shows Instagram insights on a linked post, including an em dash for missing values", () => {
    const html = renderToString(
      <ApiDropOrgTable
        applicants={[{ ...erased, accountErased: false, orgName: "Campus Club", posts: [linkedPost] }]}
      />,
    );
    expect(html).toContain("Morning workout fuel");
    expect(html).toContain("410 likes");
    expect(html).toContain("22 comments");
    expect(html).toContain("Instagram insights");
    expect(html).toContain("Reach");
    expect(html).toContain("900");
    expect(html).toContain("Views");
    expect(html).toContain(INSIGHT_MISSING);
    expect(html).toContain("Saves");
    expect(html).toContain("Shares");
    expect(html).toContain("Profile visits");
    expect(html).toContain("Follows");
    expect(html).not.toContain("Avg watch time");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("<img");
  });

  it("renders an Instagram thumbnail without sending the page referrer", () => {
    const html = renderToString(
      <ApiDropOrgTable
        applicants={[
          {
            ...erased,
            accountErased: false,
            orgName: "Epsilon Nu Tau",
            posts: [
              {
                ...linkedPost,
                thumbnailUrl: "https://scontent.cdninstagram.com/v/thumb.jpg",
              },
            ],
          },
        ]}
      />,
    );
    expect(html).toContain('src="https://scontent.cdninstagram.com/v/thumb.jpg"');
    expect(html.toLowerCase()).toContain('referrerpolicy="no-referrer"');
    expect(html).not.toContain("image-fallback");
  });

  it("renders a reel skip rate as a percentage and never above 100%", () => {
    const html = renderToString(
      <ApiDropOrgTable
        applicants={[
          {
            ...erased,
            accountErased: false,
            orgName: "Epsilon Nu Tau",
            posts: [
              {
                ...linkedPost,
                caption: "Purpose philanthropy",
                mediaType: "VIDEO",
                mediaProductType: "REELS",
                reelsSkipRate: 62.8,
                igReelsAvgWatchTime: 9600,
                igReelsVideoViewTotalTime: 11880000,
              },
              {
                ...linkedPost,
                id: "post-2",
                caption: "Impossible stored rate",
                mediaType: "VIDEO",
                mediaProductType: "REELS",
                reelsSkipRate: 6280,
              },
            ],
          },
        ]}
      />,
    );
    expect(html).toContain("Skip rate");
    expect(html).toContain("62.8%");
    expect(html).toContain("100%");
    expect(html).not.toContain("6280%");
  });
});
