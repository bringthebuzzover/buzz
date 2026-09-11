/**
 * Tombstone orgs keep university + shipping-removed copy; do not restamp
 * "Account deleted" next to the deleted display name.
 */
import { renderToString } from "react-dom/server";
import ApiDropOrgTable from "./ApiDropOrgTable";
import type { BrandDropApplicant } from "../../api/hooks/useBrandHooks";

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
  trackingNumber: null,
  attributedComments: 0,
  attributedEngagement: 0,
  attributedLikes: 0,
  attributedPostCount: 0,
  posts: [],
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
});
