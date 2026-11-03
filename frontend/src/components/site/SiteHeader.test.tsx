/* eslint-disable testing-library/no-container -- The shared harness uses React DOM; Testing Library is not installed. */
import fs from "fs";
import path from "path";
import { act } from "react";
import { Route, Routes } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { renderWithProviders } from "../../testUtils";
import SiteHeader from "./SiteHeader";

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../../contexts/SiteChromeContext", () => ({
  useSiteChrome: () => ({ openContactModal: jest.fn() }),
}));

jest.mock("../../api/hooks/useSignOut", () => ({
  useSignOut: () => jest.fn(),
}));

beforeAll(() => {
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => null,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
});

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: null, status: "anonymous" });
});

describe("SiteHeader", () => {
  it.each([
    ["/", "Join Us!"],
    ["/for-orgs", "Join Us!"],
    ["/for-brands", "Apply"],
  ])("shows %s's CTA as %s", (route, label) => {
    const { container } = renderWithProviders(<SiteHeader />, { route });
    const buttons = Array.from(container.querySelectorAll('nav[aria-label="Primary"] button'));
    expect(buttons.map((button) => button.textContent)).toContain(label);
  });

  it.each(["/", "/for-orgs", "/for-brands"])("keeps %s navigation fixed while scrolling", (route) => {
    const { container } = renderWithProviders(<SiteHeader />, { route });
    expect(container.querySelector("header")?.classList.contains("fixed")).toBe(true);
  });

  it.each([[0, "0"], [240, "0.5"], [480, "1"], [960, "1"]])(
    "grows the navigation glow at scroll %s",
    (scrollY, opacity) => {
      const { container } = renderWithProviders(<SiteHeader />);
      const previousScrollY = window.scrollY;
      try {
        Object.defineProperty(window, "scrollY", { configurable: true, value: scrollY });
        act(() => window.dispatchEvent(new Event("scroll")));
        const glow = container.querySelector<HTMLSpanElement>('nav[aria-label="Primary"] > span[aria-hidden="true"]');
        expect(glow?.style.opacity).toBe(opacity);
      } finally {
        Object.defineProperty(window, "scrollY", { configurable: true, value: previousScrollY });
      }
    },
  );

  it("renders Menu text on the accessibly named mobile trigger", () => {
    const { container } = renderWithProviders(<SiteHeader />);
    const trigger = container.querySelector('button[aria-controls="mobile-nav-menu"]');

    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toBe("Menu");
    expect(trigger?.getAttribute("aria-label")).toBe("Open menu");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  });

  it("samples below the logo and updates the wordmark when the surface changes", () => {
    const navBounds = {
      x: 100,
      y: 8,
      left: 100,
      top: 8,
      right: 900,
      bottom: 74,
      width: 800,
      height: 66,
      toJSON: () => ({}),
    } as DOMRect;
    const logoBounds = {
      x: 124,
      y: 18,
      left: 124,
      top: 18,
      right: 268,
      bottom: 58,
      width: 144,
      height: 40,
      toJSON: () => ({}),
    } as DOMRect;
    const boundsSpy = jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.getAttribute("aria-label") === "Primary") return navBounds;
        if (this.getAttribute("data-testid") === "site-header-logo") {
          return logoBounds;
        }
        return navBounds;
      });
    const paperSurface = document.createElement("section");
    paperSurface.setAttribute("data-nav-surface", "paper");
    const sampled = document.createElement("div");
    sampled.closest = jest.fn(() => paperSurface);
    let hasPaperSurface = true;
    const pointSpy = jest.fn(() => (hasPaperSurface ? sampled : null));
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: pointSpy,
    });

    try {
      const { container } = renderWithProviders(<SiteHeader />, { route: "/" });
      const logo = container.querySelector<HTMLImageElement>(
        '[data-testid="site-header-logo"] img',
      );
      const wordmarkFills = () => {
        const assetPath = new URL(logo!.src).pathname;
        const svg = new DOMParser().parseFromString(
          fs.readFileSync(path.join(__dirname, "../../../public", assetPath), "utf8"),
          "image/svg+xml",
        );
        return Array.from(svg.querySelectorAll("g[fill]"), (group) => group.getAttribute("fill"));
      };
      expect(pointSpy).toHaveBeenCalledWith(196, 86);
      expect(wordmarkFills()).toEqual(Array(5).fill("#0b0b0b"));
      expect(
        container.querySelector('nav[aria-label="Primary"]')?.className,
      ).toContain("border-on-accent/10");

      hasPaperSurface = false;
      act(() => window.dispatchEvent(new Event("resize")));
      expect(wordmarkFills()).toEqual(Array(5).fill("#ffffff"));
    } finally {
      boundsSpy.mockRestore();
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: () => null,
      });
    }
  });

  it("keeps How it works out of the guest navbar and mobile menu", () => {
    const { container } = renderWithProviders(<SiteHeader />, { route: "/" });
    const primary = container.querySelector('nav[aria-label="Primary"]');
    expect(primary?.textContent).not.toContain("How it works");

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-controls="mobile-nav-menu"]')
        ?.click();
    });
    expect(container.querySelector("#mobile-nav-menu")?.textContent).not.toContain(
      "How it works",
    );
  });
});

it.each([
  ["brand", "/brand/dashboard", "Dashboard"],
  ["org", "/org/browse", "Browse campaigns"],
] as const)("keeps signed-in %s navigation and logo in the portal", (portalRole, destination, label) => {
  (useAuth as jest.Mock).mockReturnValue({
    status: "authenticated",
    user: { portalRole, status: "active" },
  });
  const { container } = renderWithProviders(<>
    <SiteHeader />
    <Routes>
      <Route path={destination} element={<p>Portal landing</p>} />
      <Route path="*" element={null} />
    </Routes>
  </>, { route: "/for-orgs" });
  const menuButton = container.querySelector<HTMLButtonElement>('button[aria-controls="mobile-nav-menu"]');
  act(() => menuButton?.click());

  const links = Array.from(container.querySelectorAll("nav a"));
  expect(links.map((link) => link.textContent)).not.toContain("Home");
  expect(links.filter((link) => link.textContent === label)).toHaveLength(2);
  expect(links.filter((link) => link.getAttribute("href") === destination)).toHaveLength(2);

  const logo = container.querySelector<HTMLButtonElement>('[data-testid="site-header-logo"]');
  act(() => logo?.click());
  expect(container.textContent).toContain("Portal landing");
});
