/* eslint-disable testing-library/no-container -- The shared harness uses React DOM; Testing Library is not installed. */
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
