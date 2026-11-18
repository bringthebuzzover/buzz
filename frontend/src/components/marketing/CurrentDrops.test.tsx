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

  it("shows the hovered drop metadata and restores the selected drop on pointer exit", () => {
    mockCatalog.mockReturnValue({
      items: [row, { ...row, id: "drop-2", title: "Second drop", location: "Austin, TX" }],
      isLoading: false, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    const { container } = renderWithProviders(<CurrentDrops />);
    const metadata = container.querySelector(".mt-4.flex");
    const carouselRegion = container.querySelector("[data-drop-interaction]");
    const secondSlide = container.querySelectorAll<HTMLAnchorElement>("[data-drop-track] a")[2];
    const heading = container.querySelector("h2");
    const nextButton = container.querySelector('button[aria-label="Next drop"]');
    const metadataLink = () => metadata?.querySelector("a");

    expect(metadata?.textContent).toContain("Campus sampler · Ithaca, NY");
    expect(metadataLink()?.getAttribute("href")).toBe("/d/00000000-0000-0000-0000-000000000123");

    act(() => secondSlide?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(metadata?.textContent).toContain("Second drop · Austin, TX");
    expect(metadataLink()?.getAttribute("href")).toBe("/d/drop-2");
    expect((metadata as HTMLElement | null)?.style.transform)
      .toBe("translateX(clamp(0px, calc(100% + var(--drop-slide-gap)), calc(100cqw - 100%)))");
    expect(metadata?.className).toContain("w-[var(--drop-slide-width)]");
    expect(carouselRegion?.contains(metadataLink() ?? null)).toBe(true);

    act(() => secondSlide?.dispatchEvent(new MouseEvent("mouseout", {
      bubbles: true,
      relatedTarget: metadataLink(),
    })));
    expect(metadata?.textContent).toContain("Second drop · Austin, TX");
    expect(metadataLink()?.getAttribute("href")).toBe("/d/drop-2");

    act(() => carouselRegion?.dispatchEvent(new MouseEvent("mouseout", {
      bubbles: true,
      relatedTarget: heading,
    })));
    expect(metadata?.textContent).toContain("Campus sampler · Ithaca, NY");
    expect(metadataLink()?.getAttribute("href")).toBe("/d/00000000-0000-0000-0000-000000000123");

    act(() => secondSlide?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    act(() => carouselRegion?.dispatchEvent(new MouseEvent("mouseout", {
      bubbles: true,
      relatedTarget: nextButton,
    })));
    expect(metadata?.textContent).toContain("Campus sampler · Ithaca, NY");
    expect(metadataLink()?.getAttribute("href")).toBe("/d/00000000-0000-0000-0000-000000000123");
  });

  it("keeps the selected drop destination when keyboard focus overrides stale hover", () => {
    mockCatalog.mockReturnValue({
      items: [row, { ...row, id: "drop-2", title: "Second drop", location: "Austin, TX" }],
      isLoading: false, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    const { container } = renderWithProviders(<CurrentDrops />);
    const slides = container.querySelectorAll<HTMLAnchorElement>("[data-drop-track] a");
    const metadata = container.querySelector(".mt-4.flex");

    act(() => slides[2].dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(metadata?.querySelector("a")?.getAttribute("href")).toBe("/d/drop-2");

    act(() => slides[1].focus());
    expect(metadata?.textContent).toContain("Campus sampler · Ithaca, NY");
    expect(metadata?.querySelector("a")?.getAttribute("href"))
      .toBe("/d/00000000-0000-0000-0000-000000000123");

    act(() => metadata?.querySelector<HTMLAnchorElement>("a")?.focus());
    expect(metadata?.querySelector("a")?.getAttribute("href"))
      .toBe("/d/00000000-0000-0000-0000-000000000123");
  });

  it("ignores passive hover during focus-visible mode until focus leaves or pointerdown occurs", () => {
    mockCatalog.mockReturnValue({
      items: [row, { ...row, id: "drop-2", title: "Second drop", location: "Austin, TX" }],
      isLoading: false, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    const { container } = renderWithProviders(<CurrentDrops />);
    const slides = container.querySelectorAll<HTMLAnchorElement>("[data-drop-track] a");
    const metadata = container.querySelector(".mt-4.flex");
    const outsideButton = document.createElement("button");
    container.appendChild(outsideButton);
    const metadataLink = () => metadata?.querySelector("a");

    act(() => slides[1].focus());
    act(() => slides[2].dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(metadata?.textContent).toContain("Campus sampler · Ithaca, NY");
    expect(metadataLink()?.getAttribute("href")).toBe("/d/00000000-0000-0000-0000-000000000123");

    act(() => metadataLink()?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(metadataLink()?.getAttribute("href")).toBe("/d/00000000-0000-0000-0000-000000000123");

    act(() => outsideButton.focus());
    expect(metadata?.textContent).toContain("Second drop · Austin, TX");
    expect(metadataLink()?.getAttribute("href")).toBe("/d/drop-2");

    act(() => slides[1].focus());
    act(() => slides[2].dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(metadataLink()?.getAttribute("href")).toBe("/d/00000000-0000-0000-0000-000000000123");
    act(() => slides[2].dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(metadataLink()?.getAttribute("href")).toBe("/d/drop-2");
  });

  it("keeps View drop synced to the selected slide after focus-visible arrow activation", () => {
    mockCatalog.mockReturnValue({
      items: [row, { ...row, id: "drop-2", title: "Second drop" },
        { ...row, id: "drop-3", title: "Third drop" }],
      isLoading: false, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    const { container } = renderWithProviders(<CurrentDrops />);
    const slides = container.querySelectorAll<HTMLAnchorElement>("[data-drop-track] a");
    const next = container.querySelector<HTMLButtonElement>('button[aria-label="Next drop"]');
    const previous = container.querySelector<HTMLButtonElement>('button[aria-label="Previous drop"]');
    const metadata = container.querySelector(".mt-4.flex");
    const metadataLink = () => metadata?.querySelector("a");

    act(() => slides[2].dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(metadataLink()?.getAttribute("href")).toBe("/d/drop-2");

    act(() => next?.focus());
    expect(metadataLink()?.getAttribute("href")).toBe("/d/00000000-0000-0000-0000-000000000123");
    act(() => next?.click());
    expect(metadata?.textContent).toContain("Second drop");
    expect(metadataLink()?.getAttribute("href")).toBe("/d/drop-2");

    act(() => previous?.click());
    expect(metadata?.textContent).toContain("Campus sampler");
    expect(metadataLink()?.getAttribute("href")).toBe("/d/00000000-0000-0000-0000-000000000123");
  });

  it("ignores hover on the offscreen previous-slide clone", () => {
    mockCatalog.mockReturnValue({
      items: [row, { ...row, id: "drop-2", title: "Second drop" },
        { ...row, id: "drop-3", title: "Third drop", location: "Austin, TX" }],
      isLoading: false, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    const { container } = renderWithProviders(<CurrentDrops />);
    const previousSlide = container.querySelectorAll<HTMLAnchorElement>("[data-drop-track] a")[0];
    const metadata = container.querySelector(".mt-4.flex");

    act(() => previousSlide.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(metadata?.textContent).toContain("Campus sampler · Ithaca, NY");
    expect(metadata?.querySelector("a")?.getAttribute("href"))
      .toBe("/d/00000000-0000-0000-0000-000000000123");
    expect((metadata as HTMLElement | null)?.style.transform).toBe("");
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

  it("automatically advances after the randomized interval and independently pauses on hover and focus", () => {
    jest.useFakeTimers();
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.5); // delay = 3000 + 0.5 * 3000 = 4500ms
    try {
      mockCatalog.mockReturnValue({
        items: [row, { ...row, id: "drop-2", title: "Second drop" }],
        isLoading: false, error: null, hasNextPage: false,
        fetchNextPage: jest.fn(), refetch: jest.fn(),
      });
      const view = renderWithProviders(<CurrentDrops />);
      const slides = Array.from(view.container.querySelectorAll<HTMLAnchorElement>("a[aria-hidden]"));
      expect(slides.map((s) => s.getAttribute("aria-hidden"))).toEqual(["true", "false", "true", "true", "true"]);

      // Advance by 4500ms
      act(() => {
        jest.advanceTimersByTime(4500);
      });
      expect(slides.map((s) => s.getAttribute("aria-hidden"))).toEqual(["true", "true", "false", "true", "true"]);

      // Trigger focus inside carousel
      const wrapper = view.container.querySelector(".mx-auto.w-full");
      act(() => {
        slides[2].focus();
        wrapper?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      });

      // Also trigger hover
      act(() => {
        wrapper?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        wrapper?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      });

      // Pointer leaves, but keyboard focus remains inside
      act(() => {
        wrapper?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
        wrapper?.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      });
      act(() => {
        jest.advanceTimersByTime(10000);
      });
      // Must stay paused because focus is still retained
      expect(slides.map((s) => s.getAttribute("aria-hidden"))).toEqual(["true", "true", "false", "true", "true"]);

      // Blur focus away
      act(() => {
        slides[2].blur();
        wrapper?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      });
      act(() => {
        jest.advanceTimersByTime(4500);
      });
      // Now advances
      expect(slides.map((s) => s.getAttribute("aria-hidden"))).toEqual(["true", "true", "true", "false", "true"]);
    } finally {
      randomSpy.mockRestore();
      jest.useRealTimers();
    }
  });
});
