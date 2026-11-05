/* eslint-disable testing-library/no-container -- Shared harness uses React DOM; Testing Library is not installed. */
import { renderWithProviders } from "../../testUtils";
import AuthAdminHeader from "./AuthAdminHeader";

describe("AuthAdminHeader", () => {
  it("renders BUZZ logo linking back to home and Back to bringthebuzzover.com link", () => {
    const { container } = renderWithProviders(<AuthAdminHeader />);

    // Logo link to home
    const logoLink = container.querySelector<HTMLAnchorElement>('[data-testid="admin-header-logo"]');
    expect(logoLink).not.toBeNull();
    expect(logoLink?.getAttribute("href")).toBe("/");
    expect(logoLink?.getAttribute("aria-label")).toBe("BUZZ Home");

    // Back to bringthebuzzover.com link
    const backLink = Array.from(container.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("Back to bringthebuzzover.com"),
    );
    expect(backLink).toBeDefined();
    expect(backLink?.getAttribute("href")).toBe("/");
  });
});
