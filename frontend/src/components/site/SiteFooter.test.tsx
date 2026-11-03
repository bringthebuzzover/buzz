/* eslint-disable testing-library/no-container -- The shared harness uses React DOM; Testing Library is not installed. */
/**
 * Compact footer (pen Site / Footer): tours, apply, and both logins.
 */
import { renderWithProviders } from "../../testUtils";
import SiteFooter from "./SiteFooter";
import { SOCIAL_LINKS } from "./footerLinks";
import { siteIdentity } from "../../data/siteIdentity";

jest.mock("../../contexts/SiteChromeContext", () => ({
  useSiteChrome: () => ({ openContactModal: jest.fn() }),
}));

describe("SiteFooter", () => {
  it("renders full marketing content and same-tab internal navigation", () => {
    const { container } = renderWithProviders(<SiteFooter />);

    expect(container.textContent).toMatch(/How it works/);
    expect(container.textContent).toMatch(/Want to join/);
    expect(container.querySelectorAll("footer")).toHaveLength(1);
    expect(container.textContent).toMatch(/Join as a student organization/);
    expect(container.textContent).toMatch(/Apply as a brand/);
    expect(container.querySelector('a[href="/for-orgs"]')).not.toBeNull();
    expect(container.querySelector('a[href="/login"]')).not.toBeNull();
    expect(container.querySelector('a[href="/brand/login"]')).not.toBeNull();
    expect(container.querySelector('a[href="/for-orgs"]')?.hasAttribute("target")).toBe(false);
  });

  it("uses the organization conversion for the org tour", () => {
    const { container } = renderWithProviders(<SiteFooter audience="org" />);
    expect(container.querySelector("h2")?.textContent).toBe("Want to join?");
    expect(container.querySelector('a[href="/org/apply"]')?.textContent).toBe(
      "Join as a student organization",
    );
    expect(
      Array.from(container.querySelectorAll('a[href="/brand/apply"]')).some((link) =>
        link.classList.contains("h-11"),
      ),
    ).toBe(false);
  });

  it("uses the campaign request CTA for the brand tour", () => {
    const { container } = renderWithProviders(<SiteFooter audience="brand" />);
    expect(container.querySelector("h2")?.textContent).toBe("Request a campaign");
    expect(container.textContent).toContain("You request a call. BUZZ builds and publishes the drop.");
    expect(container.querySelector('a[href="/brand/apply"]')?.textContent).toBe(
      "Apply as a brand",
    );
    expect(container.querySelector('a[href="/brand/apply"]')?.tagName).toBe("A");
  });

  it("opens external and mail destinations safely", () => {
    const { container } = renderWithProviders(<SiteFooter />);
    for (const { href } of [...SOCIAL_LINKS, { href: `mailto:${siteIdentity.contact.email}` }]) {
      const anchors = container.querySelectorAll(`a[href="${href}"]`);
      expect(anchors).toHaveLength(href.startsWith("mailto:") ? 2 : 1);
      for (const anchor of anchors) {
        expect(anchor.getAttribute("target")).toBe("_blank");
        expect(anchor.getAttribute("rel")?.split(" ")).toEqual(
          expect.arrayContaining(["noopener", "noreferrer"]),
        );
      }
    }
  });
});
