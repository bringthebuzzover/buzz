import { getDropClosedReason, getDropFeedStatus } from "./dropStatus";
import type { DropStage } from "./dropStage";

describe("getDropFeedStatus", () => {
  it.each<[DropStage, boolean, string]>([
    ["upcoming", false, "upcoming"],
    ["upcoming", true, "upcoming"],
    ["applying", false, "open"],
    ["applying", true, "closed"],
    ["selecting", false, "closed"],
    ["live", false, "closed"],
    ["wrapped", false, "closed"],
    ["canceled", false, "closed"],
  ])("%s (full=%s) -> %s", (stage, full, expected) => {
    expect(getDropFeedStatus(stage, full)).toBe(expected);
  });
});

describe("getDropClosedReason", () => {
  it.each<[DropStage, boolean, string | null]>([
    ["upcoming", false, null],
    ["applying", false, null],
    ["applying", true, "spots_filled"],
    ["selecting", false, "apply_window_ended"],
    ["selecting", true, "spots_filled"],
    ["live", false, "apply_window_ended"],
    ["wrapped", false, "manual"],
    ["wrapped", true, "manual"],
  ])("%s (full=%s) -> %s", (stage, full, expected) => {
    expect(getDropClosedReason(stage, full)).toBe(expected);
  });
});
