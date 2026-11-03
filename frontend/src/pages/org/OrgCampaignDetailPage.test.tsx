/* eslint-disable testing-library/no-container -- shared React DOM render harness. */
import { renderWithProviders } from "../../testUtils";
import OrgCampaignDetailPage from "./OrgCampaignDetailPage";

const mockCampaign = jest.fn();

jest.mock("../../api/hooks/useOrgHooks", () => ({
  ...jest.requireActual("../../api/hooks/useOrgHooks"),
  useCampaignDetail: () => ({ data: mockCampaign(), isLoading: false, error: null }),
  useCampaignAggregate: () => ({ data: undefined }),
  useOrgPosts: () => ({ data: [], isLoading: false }),
  useSuggestions: () => ({ data: [] }),
}));

describe("OrgCampaignDetailPage withdrawal", () => {
  it.each([
    ["wrapped", "applied", false],
    ["wrapped", "accepted", false],
    ["canceled", "applied", false],
    ["canceled", "accepted", false],
    ["applying", "applied", true],
    ["selecting", "applied", true],
    ["live", "accepted", true],
  ])("shows Withdraw=%s/%s: %s", (stage, decision, visible) => {
    mockCampaign.mockReturnValue({
      id: "application-1",
      dropId: "drop-1",
      brandName: "Test Brand",
      title: "Test Drop",
      description: "Test campaign",
      appliedAt: 1,
      decision,
      stage,
      progress: decision === "accepted" ? "accepted" : null,
      shipments: [],
      linksOpen: false,
    });
    const { container } = renderWithProviders(<OrgCampaignDetailPage />, {
      route: "/org/campaigns/application-1", path: "/org/campaigns/:campaignId",
    });
    expect(container.querySelector('[data-testid="campaign-withdraw"]') !== null).toBe(visible);
  });
});
