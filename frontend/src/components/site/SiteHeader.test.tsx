/* eslint-disable testing-library/no-container -- The shared harness uses React DOM; Testing Library is not installed. */
import { renderWithProviders } from "../../testUtils";
import SiteHeader from "./SiteHeader";

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, status: "anonymous" }),
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

  it("renders Menu text on the accessibly named mobile trigger", () => {
    const { container } = renderWithProviders(<SiteHeader />);
    const trigger = container.querySelector('button[aria-controls="mobile-nav-menu"]');

    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toBe("Menu");
    expect(trigger?.getAttribute("aria-label")).toBe("Open menu");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  });
});
