import { act } from "react";
import { renderWithProviders as mount } from "../../../testUtils";
import { Calendar } from "./Calendar";
import { TimePicker } from "./TimePicker";
import { DatePicker } from "./DatePicker";
import { DateTimePicker } from "./DateTimePicker";
import { DateRangePicker } from "./DateRangePicker";
import {
  addDaysISO,
  compareISO,
  countDaysInclusive,
  formatISODate,
  formatISODateTime,
  parseISODate,
  parseISODateTime,
  from24Hour,
  to24Hour,
} from "./calendarUtils";

const click = (el: Element | null) => {
  expect(el).toBeTruthy();
  act(() => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const openTrigger = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]');

/**
 * The panel is portalled to `document.body` so `backdrop-filter` can see the
 * page behind it. Queries for panel content therefore start at the document,
 * not at the component container.
 */
const panel = () => document.body;

const day = (_container: HTMLElement, iso: string) =>
  document.querySelector<HTMLButtonElement>(`button[data-iso="${iso}"]`);

const panelButton = (match: (b: HTMLButtonElement) => boolean) =>
  Array.from(document.querySelectorAll("button")).find(match);

describe("calendarUtils", () => {
  it("parses and formats ISO dates accurately without timezone shifts", () => {
    const parsed = parseISODate("2026-11-24");
    expect(parsed).toEqual({ year: 2026, month: 10, day: 24 });
    expect(formatISODate(2026, 10, 24)).toBe("2026-11-24");
  });

  it("parses and formats ISO datetimes accurately", () => {
    const parsed = parseISODateTime("2026-11-24T14:30");
    expect(parsed).toEqual({
      year: 2026,
      month: 10,
      day: 24,
      hours: 14,
      minutes: 30,
    });
    expect(formatISODateTime(2026, 10, 24, 14, 30)).toBe("2026-11-24T14:30");
  });

  it("converts 12-hour and 24-hour times correctly", () => {
    expect(from24Hour(0)).toEqual({ hour12: 12, ampm: "AM" });
    expect(from24Hour(12)).toEqual({ hour12: 12, ampm: "PM" });
    expect(from24Hour(14)).toEqual({ hour12: 2, ampm: "PM" });
    expect(from24Hour(9)).toEqual({ hour12: 9, ampm: "AM" });

    expect(to24Hour(12, "AM")).toBe(0);
    expect(to24Hour(12, "PM")).toBe(12);
    expect(to24Hour(2, "PM")).toBe(14);
    expect(to24Hour(9, "AM")).toBe(9);
  });

  it("shifts dates by whole days across a month boundary", () => {
    expect(addDaysISO("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDaysISO("2026-12-01", -1)).toBe("2026-11-30");
  });

  it("compares and counts inclusive days", () => {
    expect(compareISO("2026-11-19", "2026-11-30")).toBeLessThan(0);
    expect(compareISO("2026-11-19", "2026-11-19")).toBe(0);
    expect(compareISO("2026-11-30", "2026-11-19")).toBeGreaterThan(0);
    // Reference screenshot: Nov 19 → Nov 30 reads "Apply · 12 days".
    expect(countDaysInclusive("2026-11-19", "2026-11-30")).toBe(12);
    expect(countDaysInclusive("2026-11-19", "2026-11-19")).toBe(1);
  });
});

describe("<Calendar />", () => {
  it("renders month header and weekday labels", () => {
    const view = mount(<Calendar value="2026-11-10" />);
    expect(view.container.textContent).toContain("November");
    expect(view.container.textContent).toContain("2026");
    expect(view.container.textContent).toContain("Su");
    expect(view.container.textContent).toContain("Sa");
  });

  it("invokes onChange with selected date ISO when a day is clicked", () => {
    const onChange = jest.fn();
    const view = mount(<Calendar value="2026-11-10" onChange={onChange} />);
    click(day(view.container, "2026-11-15"));
    expect(onChange).toHaveBeenCalledWith("2026-11-15");
  });
});

describe("<TimePicker />", () => {
  it("renders time display and the 15-minute list", () => {
    const view = mount(<TimePicker value="14:30" />);
    expect(view.container.textContent).toContain("2:30 PM");
    expect(view.container.querySelectorAll('[role="option"]').length).toBe(48);
  });

  it("invokes onChange when a time is picked", () => {
    const onChange = jest.fn();
    const view = mount(<TimePicker value="09:00" onChange={onChange} />);
    click(view.container.querySelector('[role="option"][aria-label="10:00 AM"]'));
    expect(onChange).toHaveBeenCalledWith("10:00");
  });
});

describe("<DatePicker />", () => {
  it("opens the popover and commits the picked date", () => {
    const onChange = jest.fn();
    const view = mount(
      <DatePicker
        id="test-date"
        label="Test Date"
        value="2026-11-10"
        onChange={onChange}
      />,
    );
    expect(view.container.textContent).toContain("Nov 10, 2026");
    click(openTrigger(view.container));
    click(day(view.container, "2026-11-18"));
    expect(onChange).toHaveBeenCalledWith({
      target: { name: undefined, value: "2026-11-18" },
    });
  });
});

describe("<DateTimePicker />", () => {
  it("renders the combined readout and opens both panels", () => {
    const view = mount(
      <DateTimePicker
        id="test-dt"
        label="Test DateTime"
        value="2026-11-24T08:52"
      />,
    );
    expect(view.container.textContent).toContain("Nov 24, 2026, 8:52 AM");
    click(openTrigger(view.container));
    expect(panel().textContent).toContain("Set to now");
    expect(panel().textContent).toContain("Done");
  });

  it("keeps the time when only the date changes", () => {
    const onChange = jest.fn();
    const view = mount(
      <DateTimePicker value="2026-11-24T08:52" onChange={onChange} />,
    );
    click(openTrigger(view.container));
    click(day(view.container, "2026-11-26"));
    expect(onChange).toHaveBeenCalledWith({
      target: { name: undefined, value: "2026-11-26T08:52" },
    });
  });
});

describe("<DateRangePicker />", () => {
  it("builds a range across two clicks and applies it", () => {
    const onChange = jest.fn();
    const view = mount(
      <DateRangePicker id="test-range" label="Window" onChange={onChange} />,
    );
    click(openTrigger(view.container));

    click(day(view.container, "2026-11-19"));
    click(day(view.container, "2026-11-30"));

    const apply = panelButton((btn) => btn.textContent?.includes("Apply") ?? false);
    expect(apply?.textContent).toContain("12 days");
    click(apply!);

    expect(onChange).toHaveBeenCalledWith({
      start: "2026-11-19T09:00",
      end: "2026-11-30T23:45",
    });
  });

  it("swaps endpoints when the second click precedes the first", () => {
    const onChange = jest.fn();
    const view = mount(<DateRangePicker onChange={onChange} />);
    click(openTrigger(view.container));

    click(day(view.container, "2026-11-30"));
    click(day(view.container, "2026-11-19"));

    const apply = panelButton((btn) => btn.textContent?.includes("Apply") ?? false);
    click(apply!);
    expect(onChange).toHaveBeenCalledWith({
      start: "2026-11-19T09:00",
      end: "2026-11-30T23:45",
    });
  });

  it("shows the committed range on the trigger", () => {
    const view = mount(
      <DateRangePicker
        value={{ start: "2026-11-19T09:00", end: "2026-11-30T23:45" }}
      />,
    );
    expect(view.container.textContent).toContain(
      "Nov 19 – Nov 30, 9:00 AM – 11:45 PM",
    );
  });

  it("blocks apply when a same-day close precedes the open", () => {
    const onChange = jest.fn();
    const view = mount(<DateRangePicker onChange={onChange} />);
    click(openTrigger(view.container));
    click(day(view.container, "2026-11-19"));
    click(day(view.container, "2026-11-19"));

    // Move the closing time to the morning of the same day.
    const closes = panelButton(
      (btn) =>
        btn.getAttribute("aria-expanded") !== null &&
        (btn.textContent?.includes("11:45") ?? false),
    );
    click(closes!);
    const amToggle = panelButton((btn) => btn.textContent?.trim() === "AM");
    click(amToggle!);
    click(document.querySelector('[role="option"][aria-label="12:00 AM"]'));

    expect(panel().textContent).toContain(
      "Closing time must not precede opening time.",
    );
  });
});
