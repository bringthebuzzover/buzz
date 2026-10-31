/* eslint-disable testing-library/no-container -- The shared harness uses React DOM; Testing Library is not installed. */
/**
 * /for-brands tour: ticket ≠ campaign, Publish, no self-serve mint.
 */
import { renderWithProviders } from "../../testUtils";

import ForBrandsPage from "./ForBrandsPage";

describe("ForBrandsPage", () => {
  it("orders network, goals and FAQs before a brand-only campaign CTA", () => {
    const { container } = renderWithProviders(<ForBrandsPage />);
    const text = container.textContent ?? "";
    expect(text.indexOf("College network")).toBeLessThan(text.indexOf("What are you hoping"));
    expect(text.indexOf("What are you hoping")).toBeLessThan(text.indexOf("Questions"));
    expect(text).not.toMatch(/Apply with your|Want to join\?/);
    const footer = container.querySelector("footer");
    expect(footer?.querySelector("h2")?.textContent).toBe("Request a campaign");
    expect(footer?.textContent).toContain("You request a call. BUZZ builds and publishes the drop.");
    expect(footer?.querySelector('a[href="/brand/apply"]')?.textContent).toBe("Apply as a brand");
  });

  it("teaches ticket then Publish, not brand-minted live drops", () => {
    const { container } = renderWithProviders(<ForBrandsPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/A representative will contact you/);
    expect(text).toMatch(/Publish/);
    expect(text).toMatch(/Selecting, Live/);
    expect(text).toMatch(/send your decisions/);
    expect(text).not.toMatch(/placehold\.co/i);
    expect(text).not.toMatch(/Multiple Campuses/);
    expect(text).toMatch(/do not create a live campaign/i);

    const apply = container.querySelector('a[href="/brand/apply"]');
    expect(apply?.textContent).toMatch(/apply as a brand/i);
  });
});
