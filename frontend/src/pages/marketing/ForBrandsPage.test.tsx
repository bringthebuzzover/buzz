/* eslint-disable testing-library/no-container -- The shared harness uses React DOM; Testing Library is not installed. */
/**
 * /for-brands tour: ticket ≠ campaign, Publish, no self-serve mint.
 */
import { renderWithProviders } from "../../testUtils";

import ForBrandsPage from "./ForBrandsPage";

describe("ForBrandsPage", () => {
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

  it("presents three numbered portal steps with their captions", () => {
    const { container } = renderWithProviders(<ForBrandsPage />);
    const steps = container.querySelectorAll("#how-it-works ol > li");
    expect(steps).toHaveLength(3);
    expect(Array.from(steps, (step) => step.querySelector("h3")?.textContent)).toEqual([
      "1 Tell us about your campaign",
      "2 BUZZ publishes your drop",
      "3 Follow every post",
    ]);
    expect(Array.from(steps, (step) => step.querySelector("h3 + p")?.textContent)).toEqual([
      "Share your goals and the products you want to send.",
      "See your published drop and available spots in the portal.",
      "Track organization posts and see the finished drop.",
    ]);
  });
});
