/**
 * Open-window spots copy (buzz-ops product/PRODUCT.md §6.3 Fork A):
 * - acceptedCount === 0 → "Up to N spots"
 * - acceptedCount > 0 (seats already accepted) → "M of N spots remaining"
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
  stage: "applying",
};

function renderOpen(acceptedCount: number): string {
  return renderToString(
    <MemoryRouter>
      <DropFeedCard
        drop={openDrop}
        acceptedCount={acceptedCount}
        feedStatus="open"
        alreadyApplied={false}
      />
    </MemoryRouter>,
  );
}

describe("DropFeedCard accepted campaign", () => {
  const closedDrop: DropCardData = {
    ...openDrop,
    applyOpenAt: Date.now() - 100_000,
    applyCloseAt: Date.now() - 1_000,
    stage: "live",
  };

  it("links an accepted seat to My Campaigns instead of a dead Closed action", () => {
    const view = renderToString(
      <MemoryRouter>
        <DropFeedCard
          drop={closedDrop}
          acceptedCount={10}
          feedStatus="closed"
          alreadyApplied
          campaignTo="/org/campaigns/app-1"
        />
      </MemoryRouter>,
    );
    expect(view).toContain('href="/org/campaigns/app-1"');
    expect(view).toContain("View campaign");
    expect(view).not.toContain(">Applied<");
    expect(view).not.toContain(">Closed</button>");
  });
});

describe("DropFeedCard Open spots copy", () => {
  it("links Apply to the canonical public drop page", () => {
    expect(renderOpen(0)).toContain('href="/d/d1"');
  });
  it("shows Up to N when acceptedCount is 0", () => {
    const view = renderOpen(0);
    expect(view).toContain("Up to 10 spots");
    expect(view).not.toContain("spots remaining");
  });

  it("shows M of N remaining when acceptedCount > 0", () => {
    const view = renderOpen(3);
    expect(view).toContain("7 of 10 spots remaining");
    expect(view).not.toContain("Up to 10 spots");
  });
});
