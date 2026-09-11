import { adminApplicantShipTo, toDatetimeLocalValue } from "./labels";

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

describe("adminApplicantShipTo", () => {
  it("shows city, state for applied and accepted", () => {
    expect(adminApplicantShipTo("applied", "Berkeley", "CA")).toBe(
      "Berkeley, CA",
    );
    expect(adminApplicantShipTo("accepted", "Ithaca", "NY")).toBe("Ithaca, NY");
  });

  it("shows Not set when city and state are missing for applied/accepted", () => {
    expect(adminApplicantShipTo("applied", null, null)).toBe("Not set");
    expect(adminApplicantShipTo("accepted", "  ", "  ")).toBe("Not set");
  });

  it("shows em dash for other decisions", () => {
    expect(adminApplicantShipTo("denied", "Berkeley", "CA")).toBe("—");
    expect(adminApplicantShipTo("withdrawn", null, null)).toBe("—");
  });
});
