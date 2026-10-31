/* eslint-disable testing-library/no-container -- The shared harness uses React DOM; Testing Library is not installed. */
import { act } from "react";
import { Route, Routes } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useBrandProfile } from "../../api/hooks/useBrandHooks";
import { renderWithProviders } from "../../testUtils";
import PortalHeader, { type Portal } from "./PortalHeader";

jest.mock("../../contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../api/hooks/useBrandHooks", () => ({ useBrandProfile: jest.fn() }));
jest.mock("../../api/hooks/useSignOut", () => ({ useSignOut: () => jest.fn() }));
jest.mock("../../contexts/SiteChromeContext", () => ({
  useSiteChrome: () => ({ openContactModal: jest.fn() }),
}));

describe("PortalHeader avatar", () => {
  it.each([
    { portal: "brand", brandName: "Sample Brand", expected: "SB" },
    { portal: "brand", brandName: "Sample", expected: "SA" },
    { portal: "brand", brandName: "  ", expected: "B" },
    { portal: "brand", brandName: undefined, expected: "B" },
    { portal: "org", brandName: undefined, expected: "TO" },
  ] as const)("renders $expected for $portal with name $brandName", ({ portal, brandName, expected }) => {
    (useAuth as jest.Mock).mockReturnValue({
      status: "authenticated",
      user: { portalRole: portal, email: "brand@example.com", instagramUsername: "@test_org" },
    });
    (useBrandProfile as jest.Mock).mockReturnValue({
      data: brandName === undefined ? undefined : { brandName },
    });

    const { container } = renderWithProviders(<PortalHeader portal={portal} />);

    expect(container.textContent).toContain(`Contact${expected}Log out`);
  });

  it.each(["org", "brand"] as Portal[])("hides the avatar when signed out of %s", (portal) => {
    (useAuth as jest.Mock).mockReturnValue({ status: "idle", user: null });

    const { container } = renderWithProviders(<PortalHeader portal={portal} />);

    expect(container.textContent).toContain("ContactLog in");
    expect(container.textContent).not.toContain("Log out");
  });
});

describe("PortalHeader navigation", () => {
  it.each([
    ["brand", "/brand/dashboard", "Dashboard"],
    ["org", "/org/browse", "Browse campaigns"],
  ] as const)("keeps %s desktop and menu links in the portal", (portal, destination, label) => {
    (useAuth as jest.Mock).mockReturnValue({
      status: "authenticated",
      user: { portalRole: portal, status: "active" },
    });
    (useBrandProfile as jest.Mock).mockReturnValue({ data: undefined });
    const { container } = renderWithProviders(<>
      <PortalHeader portal={portal} />
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

    const logo = container.querySelector<HTMLAnchorElement>('[data-testid="site-header-logo"]');
    act(() => logo?.click());
    expect(container.textContent).toContain("Portal landing");
  });
});
