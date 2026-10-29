import { DROP_STAGE_ORDER, PUBLISHED_STAGES, dropStageLabel } from "./dropStage";
import { draftedCounts } from "../components/drop/SeatDecisions";
import { deriveOrgCampaignStatus } from "./orgCampaignStatus";

describe("dropStage", () => {
  it("orders the six stages with draft first and wrapped last", () => {
    expect(DROP_STAGE_ORDER).toEqual([
      "draft",
      "upcoming",
      "applying",
      "selecting",
      "live",
      "wrapped",
    ]);
    expect(PUBLISHED_STAGES).not.toContain("draft");
    expect(DROP_STAGE_ORDER).not.toContain("canceled"); // off the path, final
  });

  it("labels current stages and tolerates legacy tracker names", () => {
    expect(dropStageLabel("selecting")).toBe("Selecting");
    expect(dropStageLabel("canceled")).toBe("Canceled");
    expect(dropStageLabel("drop_finished")).toBe("drop finished");
  });
});

describe("draftedCounts", () => {
  it("counts only decided, unsent seats", () => {
    const now = Date.now();
    expect(
      draftedCounts([
        { decision: "applied", decisionSentAt: null },
        { decision: "accepted", decisionSentAt: null },
        { decision: "accepted", decisionSentAt: now },
        { decision: "denied", decisionSentAt: null },
      ]),
    ).toEqual({ accepted: 1, denied: 1, total: 2 });
  });
});

describe("deriveOrgCampaignStatus", () => {
  it("hides ended seats and marks a canceled drop", () => {
    for (const decision of ["denied", "withdrew", "removed"]) {
      expect(deriveOrgCampaignStatus({ decision, stage: "live" })).toBeNull();
    }
    expect(deriveOrgCampaignStatus({ decision: "accepted", stage: "canceled" })).toBe("canceled");
    expect(deriveOrgCampaignStatus({ decision: "applied", stage: "canceled" })).toBe("canceled");
    expect(deriveOrgCampaignStatus({ decision: "accepted", stage: "live" })).toBe("active");
  });
});
