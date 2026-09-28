import { acceptedCampaignPath } from "./OrgDropFeedPage";
import type { CampaignItem } from "../../api/hooks/useOrgHooks";

function campaign(
  partial: Pick<CampaignItem, "id" | "dropId" | "decision">,
): CampaignItem {
  return partial as CampaignItem;
}

describe("acceptedCampaignPath", () => {
  it("opens My Campaigns for an accepted seat", () => {
    expect(
      acceptedCampaignPath(
        [campaign({ id: "app-1", dropId: "drop-1", decision: "accepted" })],
        "drop-1",
      ),
    ).toBe("/org/campaigns/app-1");
  });

  it("leaves a pending application on the feed", () => {
    expect(
      acceptedCampaignPath(
        [campaign({ id: "app-2", dropId: "drop-1", decision: "applied" })],
        "drop-1",
      ),
    ).toBeUndefined();
  });
});
