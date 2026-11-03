/* eslint-disable testing-library/no-container -- direct React DOM harness. */
import { act } from "react";
import { renderWithProviders } from "../../testUtils";
import OrgDropFeedPage from "./OrgDropFeedPage";

const mockFeed = jest.fn();
const mockCampaigns = jest.fn();
jest.mock("../../api/hooks/useOrgDropFeed", () => ({
  useOrgDropFeed: (...args: unknown[]) => mockFeed(...args),
}));
jest.mock("../../api/hooks/useOrgHooks", () => ({
  useCampaigns: (...args: unknown[]) => mockCampaigns(...args),
}));

const drop = {
  id: "00000000-0000-0000-0000-000000000063",
  brandName: "Acme",
  title: "Current campaign",
  description: "Campaign description",
  image: "https://cdn.example.test/drop.webp",
  location: "Ithaca, NY",
  capacityTotal: 8,
  applyOpenAt: Date.now() - 1000,
  applyCloseAt: Date.now() + 86400000,
  stage: "applying",
  acceptedCount: 0,
  alreadyApplied: false,
  notifyRequested: false,
  reminderMinutes: null,
};

describe("OrgDropFeedPage", () => {
  beforeEach(() => {
    mockFeed.mockReset().mockReturnValue({
      items: [drop], isLoading: false, error: null, hasNextPage: false,
      isFetchingNextPage: false, fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    mockCampaigns.mockReset().mockReturnValue({ data: [] });
  });

  it("renders current cards in a grid and links Apply to the canonical page", () => {
    const { container } = renderWithProviders(<OrgDropFeedPage />);
    expect(container.querySelector('[aria-labelledby="current-drops"] .grid')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Closed"]')).toBeNull();
    expect(container.querySelector('a[data-testid="apply-button"]')?.getAttribute("href")).toBe(`/d/${drop.id}`);
  });

  it("requests the selected status filter from the server", () => {
    const { container } = renderWithProviders(<OrgDropFeedPage />);
    const upcoming = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Upcoming",
    );
    act(() => upcoming?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(mockFeed).toHaveBeenLastCalledWith("upcoming");
  });
});
