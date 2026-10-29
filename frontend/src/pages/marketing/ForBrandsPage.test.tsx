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
});
