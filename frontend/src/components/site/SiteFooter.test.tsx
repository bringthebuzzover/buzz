/**
 * Compact footer (pen Site / Footer): tours, apply, and both logins.
 */
import { renderWithProviders } from "../../testUtils";
import SiteFooter from "./SiteFooter";

jest.mock("../../contexts/SiteChromeContext", () => ({
  useSiteChrome: () => ({ openContactModal: jest.fn() }),
}));

describe("SiteFooter", () => {
  it("lists tours, apply, and both portal logins", () => {
    const { container } = renderWithProviders(<SiteFooter />);

    expect(container.textContent).toMatch(/How it works/);
    expect(container.textContent).toMatch(/Get started/);
    expect(container.textContent).toMatch(/Apply as Organization/);
    expect(container.textContent).toMatch(/Apply as Brand/);
    expect(container.textContent).toMatch(/Organization login/);
    expect(container.textContent).toMatch(/Brand login/);
    expect(container.querySelector('a[href="/for-orgs"]')).not.toBeNull();
    expect(container.querySelector('a[href="/login"]')).not.toBeNull();
    expect(container.querySelector('a[href="/brand/login"]')).not.toBeNull();
  });
});
