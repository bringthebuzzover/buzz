/**
 * Tombstone orgs keep university + shipping-removed copy; do not restamp
 * "Account deleted" next to the deleted display name.
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
  university: "Cornell University",
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
  it("does not restamp Account deleted next to a tombstone org name", () => {
    const html = renderToString(
      <ApiDropOrgTable applicants={[erased]} />,
    );
    expect(html).toContain("Deleted organization");
    expect(html).toContain("Cornell University");
    expect(html).toContain("Shipping details removed");
    expect(html).not.toContain("Account deleted");
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
  });
});
