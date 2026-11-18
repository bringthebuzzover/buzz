import { dropStageLabel } from "./dropStage";
import { draftedCounts } from "../components/drop/SeatDecisions";
import { deriveOrgCampaignStatus } from "./orgCampaignStatus";

describe("dropStage", () => {
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
    expect(deriveOrgCampaignStatus({ decision: "accepted", stage: "wrapped" })).toBe("wrapped");
  });

  it("reads Applied while the window is open, then Under review", () => {
    expect(deriveOrgCampaignStatus({ decision: "applied", stage: "applying" })).toBe("applied");
    expect(deriveOrgCampaignStatus({ decision: "applied", stage: "selecting" })).toBe(
      "under_review",
    );
    expect(deriveOrgCampaignStatus({ decision: "applied", stage: "live" })).toBe("under_review");
  });

  it("shows a live seat's own progress from the API", () => {
    for (const progress of ["accepted", "shipped", "delivered", "posted"] as const) {
      expect(deriveOrgCampaignStatus({ decision: "accepted", stage: "live", progress })).toBe(
        progress,
      );
    }
    // Seated before the drop goes live (late add while applying).
    expect(deriveOrgCampaignStatus({ decision: "accepted", stage: "applying" })).toBe("accepted");
  });
});
