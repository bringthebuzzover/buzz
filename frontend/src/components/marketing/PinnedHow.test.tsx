/* eslint-disable testing-library/no-container -- The repository harness uses React DOM; Testing Library is not installed. */
import { renderWithProviders } from "../../testUtils";
import { PinnedHow } from "./PinnedHow";

describe("PinnedHow", () => {
  it("renders 3 step tabs, step titles, and hero laptop mockup", () => {
    const { container } = renderWithProviders(<PinnedHow />);
    expect(container.querySelector("#how-it-works")).not.toBeNull();

    const tabs = container.querySelectorAll("[role=tab]");
    expect(tabs).toHaveLength(3);
    expect(tabs[0].textContent).toBe("1. Profile");
    expect(tabs[1].textContent).toBe("2. Drops");
    expect(tabs[2].textContent).toBe("3. Collaborate");

    const chassis = container.querySelector("[data-laptop-chassis]");
    expect(chassis).not.toBeNull();

    const videos = container.querySelectorAll("video");
    expect(videos).toHaveLength(3);
  });

  it("renders reduced motion fallback with dark surface and ink data-nav-surface", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    });
    const { container } = renderWithProviders(<PinnedHow />);
    const section = container.querySelector("#how-it-works");
    expect(section?.getAttribute("data-nav-surface")).toBe("ink");
    expect(section?.className).toContain("bg-page");
  });
});
