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
  });

  it("only exposes the selected slide to keyboard and screen reader navigation", () => {
    mockCatalog.mockReturnValue({
      items: [row, { ...row, id: "drop-2" }, { ...row, id: "drop-3" }],
      isLoading: false, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    const { container } = renderWithProviders(<CurrentDrops />);
    const slides = Array.from(container.querySelectorAll<HTMLAnchorElement>("a[aria-hidden]"));
    expect(slides.map((slide) => slide.tabIndex)).toEqual([0, -1, -1]);
    expect(slides.map((slide) => slide.getAttribute("aria-hidden"))).toEqual(["false", "true", "true"]);

    act(() => container.querySelector('button[aria-label="Next drop"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(slides.map((slide) => slide.tabIndex)).toEqual([-1, 0, -1]);
    expect(slides.map((slide) => slide.getAttribute("aria-hidden"))).toEqual(["true", "false", "true"]);
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
    expect(view.container.querySelector('button[aria-label="Next drop"]')?.hasAttribute("disabled")).toBe(true);

    mockCatalog.mockReturnValue({ ...catalog, items: [] });
    view.rerender(<CurrentDrops />);
    expect(view.container.textContent).toContain("No current drops right now");
    mockCatalog.mockReturnValue(catalog);
    view.rerender(<CurrentDrops />);
    expect(view.container.textContent).toContain("Campus sampler ·");
    expect(view.container.querySelector('button[aria-label="Previous drop"]')?.hasAttribute("disabled")).toBe(true);
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
});
