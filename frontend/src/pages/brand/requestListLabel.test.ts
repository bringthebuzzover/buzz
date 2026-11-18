import { requestListLabel } from "./BrandAggregateDashboardPage";

describe("requestListLabel", () => {
  it("prefers a trimmed title", () => {
    expect(
      requestListLabel({
        title: "  Fall Cold Brew  ",
        message: "Longer brief",
      }),
    ).toBe("Fall Cold Brew");
  });

  it("uses the first non-empty line of the message when title is blank", () => {
    expect(
      requestListLabel({
        title: "   ",
        message: "\n  E2E plan campaign ticket\nMore detail",
      }),
    ).toBe("E2E plan campaign ticket");
  });

  it("uses the message when title is missing", () => {
    expect(requestListLabel({ title: null, message: "Just a note" })).toBe(
      "Just a note",
    );
  });
});
