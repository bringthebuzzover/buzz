import {
  shipToCity,
  formatCompactCount,
  toDatetimeLocalValue,
} from "./labels";

describe("toDatetimeLocalValue", () => {
  it("formats local wall-clock YYYY-MM-DDTHH:mm (not UTC ISO slice)", () => {
    const local = new Date(2026, 7, 11, 14, 30, 45, 123);
    expect(toDatetimeLocalValue(local.getTime())).toBe("2026-08-11T14:30");
  });

  it("pads single-digit month, day, hour, and minute", () => {
    const local = new Date(2026, 0, 5, 3, 7);
    expect(toDatetimeLocalValue(local.getTime())).toBe("2026-01-05T03:07");
  });

  it("round-trips through Date local parse used on save", () => {
    const seeded = toDatetimeLocalValue(new Date(2026, 7, 11, 9, 15).getTime());
    const saved = new Date(seeded);
    expect(saved.getFullYear()).toBe(2026);
    expect(saved.getMonth()).toBe(7);
    expect(saved.getDate()).toBe(11);
    expect(saved.getHours()).toBe(9);
    expect(saved.getMinutes()).toBe(15);
  });
});

describe("shipToCity", () => {
  it.each([
    ["Berkeley", "CA", "Berkeley, CA"],
    ["Ithaca", null, "Ithaca"],
    [null, null, ""],
    ["  ", "  ", ""],
  ])("%p, %p -> %p", (city, state, expected) => {
    expect(shipToCity(city, state)).toBe(expected);
  });
});

describe("formatCompactCount", () => {
  it("keeps small integers as digits", () => {
    expect(formatCompactCount(0)).toBe("0");
    expect(formatCompactCount(999)).toBe("999");
  });

  it("abbreviates thousands and millions", () => {
    expect(formatCompactCount(1500)).toBe("1.5K");
    expect(formatCompactCount(1_200_000)).toBe("1.2M");
  });

  it("shows an em dash when the count is missing", () => {
    expect(formatCompactCount(null)).toBe("—");
    expect(formatCompactCount(undefined)).toBe("—");
  });
});
