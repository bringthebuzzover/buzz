/**
 * Open-window spots copy (PRODUCT.md §6.3 Fork A):
 * - acceptedCount === 0 → "Up to N spots"
 * - acceptedCount > 0 (reopen leftovers) → "M of N spots remaining"
 *
 * Uses renderToString like smoke.test.tsx (no RTL dep in this package).
 */
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import DropFeedCard from "./DropFeedCard";
import type { DropCardData } from "../../types/drop";

const openDrop: DropCardData = {
  id: "d1",
  brandName: "Acme",
  title: "Test Drop",
  description: "A test drop.",
  image: "https://example.test/img.png",
  location: "Test City",
  capacityTotal: 10,
  applyOpenAt: Date.now() - 1_000,
  applyCloseAt: Date.now() + 100_000,
  manualReopen: false,
};

function renderOpen(acceptedCount: number): string {
  return renderToString(
    <MemoryRouter>
      <DropFeedCard
        drop={openDrop}
        acceptedCount={acceptedCount}
        feedStatus="open"
        alreadyApplied={false}
        onApply={() => {}}
      />
    </MemoryRouter>,
  );
}

describe("DropFeedCard accepted campaign", () => {
  const closedDrop: DropCardData = {
    ...openDrop,
    applyOpenAt: Date.now() - 100_000,
    applyCloseAt: Date.now() - 1_000,
    applicantSelectionFinalizedAt: Date.now() - 1_000,
  };

  it("links an accepted seat to My Campaigns instead of a dead Closed action", () => {
    const html = renderToString(
      <MemoryRouter>
        <DropFeedCard
          drop={closedDrop}
          acceptedCount={10}
          feedStatus="closed"
          alreadyApplied
          campaignTo="/org/campaigns/app-1"
          onApply={() => {}}
        />
      </MemoryRouter>,
    );
    expect(html).toContain('href="/org/campaigns/app-1"');
    expect(html).toContain("View campaign");
    expect(html).not.toContain(">Applied<");
    expect(html).not.toContain(">Closed</button>");
  });
});

describe("DropFeedCard Open spots copy", () => {
  it("shows Up to N when acceptedCount is 0", () => {
    const html = renderOpen(0);
    expect(html).toContain("Up to 10 spots");
    expect(html).not.toContain("spots remaining");
  });

  it("shows M of N remaining when acceptedCount > 0", () => {
    const html = renderOpen(3);
    expect(html).toContain("7 of 10 spots remaining");
    expect(html).not.toContain("Up to 10 spots");
  });
});
