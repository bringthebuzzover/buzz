import {
  matchPreset,
  monthGrid,
  pickDay,
  presetRange,
  rangeDays,
  sameDay,
} from "./dateRange";

const today = new Date(2026, 9, 27); // Tue, Oct 27 2026

describe("drop editor date range", () => {
  it("makes Next 2 weeks the coming Monday through the next Friday", () => {
    const range = presetRange("two-weeks", today);
    expect(sameDay(range?.start ?? null, new Date(2026, 10, 2))).toBe(true);
    expect(sameDay(range?.end ?? null, new Date(2026, 10, 13))).toBe(true);
    expect(rangeDays(range ?? { start: null, end: null })).toBe(12);
  });

  it("matches the seeded range to its preset and anything else to custom", () => {
    expect(
      matchPreset({ start: new Date(2026, 10, 2), end: new Date(2026, 10, 13) }, today),
    ).toBe("two-weeks");
    expect(
      matchPreset({ start: new Date(2026, 10, 3), end: new Date(2026, 10, 13) }, today),
    ).toBe("custom");
  });

  it("ends This week on Saturday and This month on the last day", () => {
    expect(presetRange("week", today)?.end?.getDate()).toBe(31);
    expect(presetRange("month", today)?.end?.getDate()).toBe(31);
  });

  it("lays October 2026 out from Thursday", () => {
    const cells = monthGrid(new Date(2026, 9, 1));
    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells[4]?.getDate()).toBe(1);
    expect(cells.length).toBe(4 + 31);
  });

  it("sets the start, then the end, and restarts on an earlier day", () => {
    const start = pickDay({ start: null, end: null }, new Date(2026, 10, 5));
    expect(start.end).toBeNull();
    const done = pickDay(start, new Date(2026, 10, 9));
    expect(rangeDays(done)).toBe(5);
    const restart = pickDay(start, new Date(2026, 10, 1));
    expect(restart.start?.getDate()).toBe(1);
    expect(restart.end).toBeNull();
  });
});
