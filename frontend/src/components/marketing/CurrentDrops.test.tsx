/* eslint-disable testing-library/no-container -- the repo harness uses React DOM directly. */
import { act } from "react";
import { renderWithProviders } from "../../testUtils";
import { CurrentDrops } from "./sections";

const mockCatalog = jest.fn();
jest.mock("../../api/hooks/useDropHooks", () => ({
  usePublicDropCatalog: (...args: unknown[]) => mockCatalog(...args),
}));

const row = {
  id: "00000000-0000-0000-0000-000000000123",
  brandName: "Acme",
  title: "Campus sampler",
  description: "A real campaign",
  image: "https://cdn.example.test/drop.webp",
  location: "Ithaca, NY",
  stage: "applying",
  applyOpenAt: 1,
  applyCloseAt: 2,
  capacityTotal: 10,
};

describe("CurrentDrops", () => {
  it("links catalog items to their canonical public detail pages", () => {
    mockCatalog.mockReturnValue({
      items: [row], isLoading: false, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    const { container } = renderWithProviders(<CurrentDrops />);
    expect(container.textContent).toContain("Campus sampler");
    expect(container.querySelector('a[href="/d/00000000-0000-0000-0000-000000000123"]')).not.toBeNull();
    expect(container.textContent).toContain("View drop");
    expect(container.querySelector('a[href="/d/00000000-0000-0000-0000-000000000123"]')?.className)
      .toContain("w-[var(--drop-slide-width)]");
    expect(container.querySelector(".mt-4.flex")?.className)
      .toContain("w-[var(--drop-slide-width)]");
  });

  it("repeats a lone drop and loops in both directions", () => {
    mockCatalog.mockReturnValue({
      items: [row], isLoading: false, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    const { container } = renderWithProviders(<CurrentDrops />);
    const slides = Array.from(container.querySelectorAll<HTMLAnchorElement>("a[aria-hidden]"));
    expect(slides).toHaveLength(4);
    expect(slides.every((slide) => slide.getAttribute("href") === "/d/00000000-0000-0000-0000-000000000123")).toBe(true);
    expect(slides.map((slide) => slide.getAttribute("aria-hidden"))).toEqual(["true", "false", "true", "true"]);

    const next = container.querySelector('button[aria-label="Next drop"]');
    const previous = container.querySelector('button[aria-label="Previous drop"]');
    expect(next?.hasAttribute("disabled")).toBe(false);
    expect(previous?.hasAttribute("disabled")).toBe(false);

    act(() => next?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(slides.map((slide) => slide.getAttribute("aria-hidden"))).toEqual(["true", "true", "false", "true"]);
    act(() => container.querySelector("[data-drop-track]")
      ?.dispatchEvent(new Event("transitionend", { bubbles: true })));
    expect(slides.map((slide) => slide.getAttribute("aria-hidden"))).toEqual(["true", "false", "true", "true"]);
    act(() => next?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => container.querySelector("[data-drop-track]")
      ?.dispatchEvent(new Event("transitionend", { bubbles: true })));
    act(() => previous?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(slides.map((slide) => slide.getAttribute("aria-hidden"))).toEqual(["false", "true", "true", "true"]);
    act(() => container.querySelector("[data-drop-track]")
      ?.dispatchEvent(new Event("transitionend", { bubbles: true })));
    expect(slides.map((slide) => slide.getAttribute("aria-hidden"))).toEqual(["true", "false", "true", "true"]);
  });

  it("only exposes the selected slide to keyboard and screen reader navigation", () => {
    mockCatalog.mockReturnValue({
      items: [row, { ...row, id: "drop-2" }, { ...row, id: "drop-3" }],
      isLoading: false, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    const { container } = renderWithProviders(<CurrentDrops />);
    const slides = Array.from(container.querySelectorAll<HTMLAnchorElement>("a[aria-hidden]"));
    expect(slides.map((slide) => slide.tabIndex)).toEqual([-1, 0, -1, -1, -1, -1]);
    expect(slides.map((slide) => slide.getAttribute("aria-hidden"))).toEqual(["true", "false", "true", "true", "true", "true"]);

    act(() => container.querySelector('button[aria-label="Next drop"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(slides.map((slide) => slide.tabIndex)).toEqual([-1, -1, 0, -1, -1, -1]);
    expect(slides.map((slide) => slide.getAttribute("aria-hidden"))).toEqual(["true", "true", "false", "true", "true", "true"]);
    expect(container.querySelector('a:not([aria-hidden])[href="/d/drop-2"]')?.textContent).toBe("View drop");
    expect(container.querySelector('button[aria-label="Previous drop"]')?.hasAttribute("disabled")).toBe(false);
    expect(container.querySelector('button[aria-label="Next drop"]')?.hasAttribute("disabled")).toBe(false);
  });

  it("clamps the selected drop when results shrink and resets after an empty refetch", () => {
    const items = [row, { ...row, id: "drop-2", title: "Second drop" },
      { ...row, id: "drop-3", title: "Third drop" }];
    const catalog = {
      items, isLoading: false, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    };
    mockCatalog.mockReturnValue(catalog);
    const view = renderWithProviders(<CurrentDrops />);
    const next = view.container.querySelector('button[aria-label="Next drop"]');
    act(() => next?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => next?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(view.container.textContent).toContain("Third drop ·");

    mockCatalog.mockReturnValue({ ...catalog, items: items.slice(0, 2) });
    view.rerender(<CurrentDrops />);
    expect(view.container.textContent).toContain("Second drop ·");
    expect(view.container.querySelector('button[aria-label="Next drop"]')?.hasAttribute("disabled")).toBe(false);

    mockCatalog.mockReturnValue({ ...catalog, items: [] });
    view.rerender(<CurrentDrops />);
    expect(view.container.textContent).toContain("No current drops right now");
    mockCatalog.mockReturnValue(catalog);
    view.rerender(<CurrentDrops />);
    expect(view.container.textContent).toContain("Campus sampler ·");
    expect(view.container.querySelector('button[aria-label="Previous drop"]')?.hasAttribute("disabled")).toBe(false);
  });

  it("shows loading, empty, and retryable error states", () => {
    mockCatalog.mockReturnValue({
      items: [], isLoading: true, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    const view = renderWithProviders(<CurrentDrops />);
    expect(view.container.textContent).toContain("Loading current drops");

    mockCatalog.mockReturnValue({
      items: [], isLoading: false, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    view.rerender(<CurrentDrops />);
    expect(view.container.textContent).toContain("No current drops right now");

    mockCatalog.mockReturnValue({
      items: [], isLoading: false, error: new Error("offline"), hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    view.rerender(<CurrentDrops />);
    expect(view.container.textContent).toContain("Could not load current drops");
    expect(view.container.querySelector("button")?.textContent).toBe("Try again");
  });

  it("automatically advances after the randomized interval and pauses on hover/focus", () => {
    jest.useFakeTimers();
    try {
      mockCatalog.mockReturnValue({
        items: [row, { ...row, id: "drop-2", title: "Second drop" }],
        isLoading: false, error: null, hasNextPage: false,
        fetchNextPage: jest.fn(), refetch: jest.fn(),
      });
      const view = renderWithProviders(<CurrentDrops />);
      const slides = Array.from(view.container.querySelectorAll<HTMLAnchorElement>("a[aria-hidden]"));
      expect(slides.map((s) => s.getAttribute("aria-hidden"))).toEqual(["true", "false", "true", "true", "true"]);

      // Advance by 6 seconds (max delay is 6000ms)
      act(() => {
        jest.advanceTimersByTime(6500);
      });
      expect(slides.map((s) => s.getAttribute("aria-hidden"))).toEqual(["true", "true", "false", "true", "true"]);

      // Trigger hover (React listens to mouseover for onMouseEnter)
      const wrapper = view.container.querySelector(".mx-auto.w-full");
      act(() => {
        wrapper?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        wrapper?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      });
      act(() => {
        jest.advanceTimersByTime(10000);
      });
      // Should remain paused on the current slide
      expect(slides.map((s) => s.getAttribute("aria-hidden"))).toEqual(["true", "true", "false", "true", "true"]);

      // Trigger mouse leave (React listens to mouseout for onMouseLeave)
      act(() => {
        wrapper?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
        wrapper?.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      });
      act(() => {
        jest.advanceTimersByTime(6500);
      });
      // Should advance again
      expect(slides.map((s) => s.getAttribute("aria-hidden"))).toEqual(["true", "true", "true", "false", "true"]);
    } finally {
      jest.useRealTimers();
    }
  });
});
