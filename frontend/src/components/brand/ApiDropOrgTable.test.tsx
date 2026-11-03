/**
 * An erased org stays on the participant list as an anonymized frozen row.
 * A live org still shows its linked post and insights.
 */
import { renderToString } from "react-dom/server";
import ApiDropOrgTable from "./ApiDropOrgTable";
import type { BrandDropApplicant, BrandDropPost } from "../../api/hooks/useBrandHooks";
import { INSIGHT_MISSING } from "../posts/insightMetrics";

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
  decisionSentAt: Date.now(),
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
  it("shows each live seat's progress and keeps ended seats that took part", () => {
    const live = { ...erased, accountErased: false };
    const view = renderToString(
      <ApiDropOrgTable
        applicants={[
          { ...live, id: "a", orgName: "Shipped Club", progress: "shipped" },
          { ...live, id: "b", orgName: "Posting Club", progress: "posted" },
          {
            ...live,
            id: "c",
            orgName: "Left Club",
            decision: "withdrew",
            shipments: [{ id: "s", trackingNumber: "1Z", carrier: "ups", trackUrl: null }],
          },
          { ...live, id: "d", orgName: "Gone Early", decision: "withdrew" },
          { ...live, id: "e", orgName: "Pulled Club", decision: "removed", attributedPostCount: 1 },
          { ...live, id: "f", orgName: "Drafted Club", decisionSentAt: null },
        ]}
      />,
    );
    expect(view).toContain("Shipped</span>");
    expect(view).toContain("Posted</span>");
    expect(view).toContain("Left Club");
    expect(view).toContain("Withdrew");
    expect(view).toContain("Removed by BUZZ");
    expect(view).not.toContain("Gone Early"); // withdrew before taking part
    expect(view).not.toContain("Drafted Club"); // acceptance not sent yet
  });

  it("shows an erased org as a frozen anonymized participant", () => {
    const view = renderToString(
      <ApiDropOrgTable applicants={[erased]} />,
    );
    expect(view).toContain("Deleted organization");
    expect(view).toContain("Metrics frozen");
    expect(view).not.toContain("Cornell University");
    expect(view).not.toContain("Ship to");
    expect(view).not.toContain("Account deleted");
  });

  it("keeps a missing address as Address pending in the warn tone", () => {
    const view = renderToString(
      <ApiDropOrgTable
        applicants={[{ ...erased, accountErased: false, orgName: "Campus Club" }]}
      />,
    );
    expect(view).toContain("Ship to");
    expect(view).toMatch(
      /<span data-testid="address-pending" class="[^"]*text-accent[^"]*">Address pending<\/span>/,
    );
  });

  it("shows Instagram insights on a linked post, including an em dash for missing values", () => {
    const view = renderToString(
      <ApiDropOrgTable
        applicants={[{ ...erased, accountErased: false, orgName: "Campus Club", posts: [linkedPost] }]}
      />,
    );
    expect(view).toContain("Morning workout fuel");
    expect(view).toContain("410 likes");
    expect(view).toContain("22 comments");
    expect(view).toContain("Instagram insights");
    expect(view).toContain("Reach");
    expect(view).toContain("900");
    expect(view).toContain("Views");
    expect(view).toContain(INSIGHT_MISSING);
    expect(view).toContain("Saves");
    expect(view).toContain("Shares");
    expect(view).toContain("Profile visits");
    expect(view).toContain("Follows");
    expect(view).not.toContain("Avg watch time");
    expect(view).not.toContain("undefined");
    expect(view).not.toContain("NaN");
    expect(view).not.toContain("<img");
  });

  it("renders an Instagram thumbnail without sending the page referrer", () => {
    const view = renderToString(
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
    expect(view).toContain('src="https://scontent.cdninstagram.com/v/thumb.jpg"');
    expect(view.toLowerCase()).toContain('referrerpolicy="no-referrer"');
    expect(view).not.toContain("image-fallback");
  });

  it("renders a reel skip rate as a percentage and never above 100%", () => {
    const view = renderToString(
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
    expect(view).toContain("Skip rate");
    expect(view).toContain("62.8%");
    expect(view).toContain("100%");
    expect(view).not.toContain("6280%");
  });
});
