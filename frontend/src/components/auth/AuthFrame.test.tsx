/* eslint-disable testing-library/no-container -- Shared harness uses React DOM; Testing Library is not installed. */
import { renderWithProviders } from "../../testUtils";
import { AuthSplit } from "./AuthFrame";

describe("AuthAside and AuthSplit", () => {
  it("renders Logo linking to home in aside, and Back to bringthebuzzover.com link on the right form side", () => {
    const { container } = renderWithProviders(
      <AuthSplit>
        <p>Form content</p>
      </AuthSplit>,
    );

    const aside = container.querySelector('[data-testid="auth-aside"]');
    expect(aside).not.toBeNull();
    expect(aside?.textContent).toContain(
      "Connecting brands with campus communities for authentic college marketing, at scale.",
    );

    // Top row logo link to / in aside
    const logoLink = aside?.querySelector<HTMLAnchorElement>('a[aria-label="BUZZ Home"]');
    expect(logoLink).not.toBeNull();
    expect(logoLink?.getAttribute("href")).toBe("/");

    // Back to bringthebuzzover.com link is NOT on top of the image in aside
    const asideBackLink = Array.from(aside?.querySelectorAll("a") || []).find((a) =>
      a.textContent?.includes("Back to bringthebuzzover.com"),
    );
    expect(asideBackLink).toBeUndefined();

    // Back to bringthebuzzover.com link IS rendered on the right page / form side
    const formContainer = container.querySelector('[data-testid="auth-form"]')?.parentElement?.parentElement;
    expect(formContainer).not.toBeNull();
    const pageBackLink = Array.from(formContainer?.querySelectorAll("a") || []).find((a) =>
      a.textContent?.includes("Back to bringthebuzzover.com"),
    );
    expect(pageBackLink).toBeDefined();
    expect(pageBackLink?.getAttribute("href")).toBe("/");

    // Non-interactive bringthebuzzover.com text is removed
    const paragraphs = Array.from(aside?.querySelectorAll("p") || []);
    const staticFooter = paragraphs.find(
      (p) => p.textContent === "bringthebuzzover.com",
    );
    expect(staticFooter).toBeUndefined();
  });

  it("allows an auth page to override only its aside statement", () => {
    const { container } = renderWithProviders(
      <AuthSplit asideStatement="Join as a student organization and work with brands on real campus campaigns.">
        <p>Form content</p>
      </AuthSplit>,
    );
    const aside = container.querySelector('[data-testid="auth-aside"]');
    expect(aside?.textContent).toContain(
      "Join as a student organization and work with brands on real campus campaigns.",
    );
    expect(aside?.textContent).not.toContain("Connecting brands with campus communities");
  });
});
