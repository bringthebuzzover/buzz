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
