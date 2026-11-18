/* eslint-disable testing-library/no-container -- The repository harness uses React DOM; Testing Library is not installed. */
import { act } from "react";
import { renderWithProviders } from "../../testUtils";
import { FaqList } from "./sections";

describe("FaqList", () => {
  const sampleItems = [
    { q: "Question 1", a: "Answer 1" },
    { q: "Question 2", a: "Answer 2" },
    { q: "Question 3", a: "Answer 3" },
  ];

  it("keeps all items closed by default on first load", () => {
    const { container } = renderWithProviders(<FaqList items={sampleItems} />);
    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(3);
    expect(details[0].hasAttribute("open")).toBe(false);
    expect(details[1].hasAttribute("open")).toBe(false);
    expect(details[2].hasAttribute("open")).toBe(false);

    // Initial closed state uses text-primary and text-muted for indicator
    const summary0 = details[0].querySelector("summary");
    expect(summary0?.className).toContain("text-primary");
    expect(summary0?.className).not.toMatch(/(^|\s)text-accent(\s|$)/);

    const indicator0 = summary0?.querySelector("span[aria-hidden]");
    expect(indicator0?.className).toContain("text-muted");
    expect(indicator0?.className).not.toMatch(/(^|\s)text-accent(\s|$)/);
  });

  it("automatically opens another item when hovered and highlights question text and indicator in yellow", () => {
    const { container } = renderWithProviders(<FaqList items={sampleItems} />);
    const details = container.querySelectorAll("details");
    const summary1 = details[1].querySelector("summary");
    const indicator1 = summary1?.querySelector("span[aria-hidden]");
    const summary2 = details[2].querySelector("summary");
    const indicator2 = summary2?.querySelector("span[aria-hidden]");

    act(() => {
      details[1].dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });

    expect(details[0].hasAttribute("open")).toBe(false);
    expect(details[1].hasAttribute("open")).toBe(true);
    expect(details[2].hasAttribute("open")).toBe(false);
    expect(summary1?.className).toMatch(/(^|\s)text-accent(\s|$)/);
    expect(indicator1?.className).toMatch(/(^|\s)text-accent(\s|$)/);

    act(() => {
      details[2].dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });

    expect(details[0].hasAttribute("open")).toBe(false);
    expect(details[1].hasAttribute("open")).toBe(false);
    expect(details[2].hasAttribute("open")).toBe(true);
    expect(summary1?.className).not.toMatch(/(^|\s)text-accent(\s|$)/);
    expect(indicator1?.className).toMatch(/(^|\s)text-muted(\s|$)/);
    expect(summary2?.className).toMatch(/(^|\s)text-accent(\s|$)/);
    expect(indicator2?.className).toMatch(/(^|\s)text-accent(\s|$)/);
  });

  it("toggles an item when summary is clicked and applies yellow accent", () => {
    const { container } = renderWithProviders(<FaqList items={sampleItems} />);
    const details = container.querySelectorAll("details");
    const summary0 = details[0].querySelector("summary");
    const indicator0 = summary0?.querySelector("span[aria-hidden]");

    expect(details[0].hasAttribute("open")).toBe(false);

    act(() => {
      summary0?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(details[0].hasAttribute("open")).toBe(true);
    expect(summary0?.className).toMatch(/(^|\s)text-accent(\s|$)/);
    expect(indicator0?.className).toMatch(/(^|\s)text-accent(\s|$)/);

    act(() => {
      summary0?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(details[0].hasAttribute("open")).toBe(false);
    expect(summary0?.className).not.toMatch(/(^|\s)text-accent(\s|$)/);
    expect(indicator0?.className).toMatch(/(^|\s)text-muted(\s|$)/);
  });

  it("ignores hover on touch devices (hover: none) and relies on tap/click", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query === "(hover: none)",
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    try {
      const { container } = renderWithProviders(<FaqList items={sampleItems} />);
      const details = container.querySelectorAll("details");
      const summary1 = details[1].querySelector("summary");

      // Touch simulated hover should NOT open
      act(() => {
        details[1].dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      });
      expect(details[1].hasAttribute("open")).toBe(false);

      // But a tap/click DOES open
      act(() => {
        summary1?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      expect(details[1].hasAttribute("open")).toBe(true);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
