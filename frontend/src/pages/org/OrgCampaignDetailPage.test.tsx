/* eslint-disable testing-library/no-container -- shared React DOM render harness. */
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithProviders } from "../../testUtils";
import { ApiError } from "../../api/errors";
import type { CampaignDetail } from "../../api/hooks/useOrgHooks";
import OrgMyCampaignsPage from "./OrgMyCampaignsPage";
import OrgDropFeedPage from "./OrgDropFeedPage";
import PublicDropPage from "../public/PublicDropPage";
import OrgCampaignDetailPage from "./OrgCampaignDetailPage";

const mockCampaign = jest.fn();
const mockApiFetch = jest.fn();

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    status: "authenticated", user: { portalRole: "org", status: "active" },
  }),
}));

jest.mock("../../api/client", () => ({
  ...jest.requireActual("../../api/client"),
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("../../api/hooks/useOrgHooks", () => ({
  ...jest.requireActual("../../api/hooks/useOrgHooks"),
  useCampaignDetail: (...args: unknown[]) => mockCampaign(...args),
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
    mockCampaign.mockReturnValue({ data: {
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
    }, isLoading: false, error: null });
    const { container } = renderWithProviders(<OrgCampaignDetailPage />, {
      route: "/org/campaigns/application-1", path: "/org/campaigns/:campaignId",
    });
    expect(container.querySelector('[data-testid="campaign-withdraw"]') !== null).toBe(visible);
  });
});

/** The real query hooks share one warmed cache across all withdrawal surfaces. */
describe("Org withdrawal cache refresh", () => {
  const campaign = {
    id: "application-1", dropId: "drop-1", orgId: "org-1",
    brandName: "Test Brand", title: "Test Drop", description: "Test campaign",
    image: "https://example.test/drop.webp", appliedAt: 1,
    applyOpenAt: 1, applyCloseAt: Date.now() + 86400000,
    decision: "applied", decisionAt: null, deliveredAt: null,
    stage: "applying", progress: null, shipments: [], linksOpen: false,
    allocatedUnits: null, totalProductUnits: null, pitch: null, capacityTotal: 10,
  } satisfies CampaignDetail;
  const drop = {
    ...campaign, id: campaign.dropId, location: "Test City",
    acceptedCount: 0, alreadyApplied: true, notifyRequested: false, reminderMinutes: null,
  };
  const keys = [
    ["campaigns"], ["campaign-detail", campaign.id],
    ["org-drop-feed", "all"], ["drop-detail", campaign.dropId],
  ];

  beforeEach(() => {
    mockApiFetch.mockReset();
    mockCampaign.mockImplementation(
      jest.requireActual("../../api/hooks/useOrgHooks").useCampaignDetail,
    );
  });

  function renderWithdrawal(failure?: ApiError) {
    let withdrawn = false;
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        if (failure) throw failure;
        withdrawn = true;
        return { data: null, meta: null };
      }
      const updatedCampaign = { ...campaign, decision: withdrawn ? "withdrew" : "applied" };
      const updatedDrop = { ...drop, alreadyApplied: !withdrawn };
      if (path === "/api/campaigns") return { data: [updatedCampaign], meta: null };
      if (path === `/api/campaigns/${campaign.id}`) return { data: updatedCampaign, meta: null };
      if (path.startsWith("/api/drops?")) return { data: [updatedDrop], meta: { total: 1 } };
      if (path === `/api/drops/${drop.id}`) return { data: updatedDrop, meta: null };
      throw new Error(`Unexpected request: ${path}`);
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
    });
    queryClient.setQueryData(keys[0], [campaign]);
    queryClient.setQueryData(keys[1], campaign);
    queryClient.setQueryData(keys[2], {
      pages: [{ data: [drop], meta: { total: 1 } }], pageParams: [1],
    });
    queryClient.setQueryData(keys[3], drop);
    const view = renderWithProviders(
      <QueryClientProvider client={queryClient}>
        <section aria-label="Campaign">
          <MemoryRouter initialEntries={[`/org/campaigns/${campaign.id}`]}>
            <Routes>
              <Route path="/org/campaigns/:campaignId" element={<OrgCampaignDetailPage />} />
              <Route path="/org/campaigns" element={<OrgMyCampaignsPage />} />
            </Routes>
          </MemoryRouter>
        </section>
        <section aria-label="Browse">
          <MemoryRouter><OrgDropFeedPage /></MemoryRouter>
        </section>
        <section aria-label="Drop detail">
          <MemoryRouter initialEntries={[`/d/${drop.id}`]}>
            <Routes><Route path="/d/:dropId" element={<PublicDropPage />} /></Routes>
          </MemoryRouter>
        </section>
      </QueryClientProvider>,
      { router: false },
    );
    return { ...view, queryClient };
  }

  async function click(element: Element | null) {
    expect(element).not.toBeNull();
    await act(async () => {
      (element as HTMLElement).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function assertApply(container: HTMLElement, applied: boolean) {
    const feedAction = container.querySelector('[aria-label="Browse"] [data-testid="apply-button"]');
    const detailAction = container.querySelector('[aria-label="Drop detail"] [data-testid="apply-button"]');
    expect(feedAction?.textContent).toBe(applied ? "Already applied" : "Apply");
    expect(detailAction?.textContent).toBe(applied ? "Already applied" : "Apply");
    expect(detailAction?.hasAttribute("disabled")).toBe(applied);
    if (!applied) expect(feedAction?.getAttribute("href")).toBe(`/d/${drop.id}`);
  }

  it("refetches the warm campaign, feed and detail caches after withdrawal and restores Apply", async () => {
    const { container, queryClient } = renderWithdrawal();
    assertApply(container, true);
    expect(mockApiFetch).not.toHaveBeenCalled();
    await click(container.querySelector('[data-testid="campaign-withdraw"]'));
    await click(document.querySelector('[data-testid="campaign-withdraw-confirm"]'));

    expect(mockApiFetch).toHaveBeenCalledTimes(5);
    expect(mockApiFetch.mock.calls).toEqual(expect.arrayContaining([
      [`/api/campaigns/${campaign.id}/withdraw`, { method: "POST" }],
      ["/api/campaigns"], [`/api/campaigns/${campaign.id}`],
      ["/api/drops?page=1&per_page=50&status=all"], [`/api/drops/${drop.id}`],
    ]));
    expect(queryClient.getQueryData<CampaignDetail>(keys[1])?.decision).toBe("withdrew");
    expect(container.querySelector('[aria-label="Campaign"]')?.textContent).toContain("You have no campaigns yet");
    expect(container.querySelector('[aria-label="Campaign"] a[href="/org/campaigns/application-1"]')).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    assertApply(container, false);
  });

  it("canceling preserves the application and warm caches without a mutation or refetch", async () => {
    const { container, queryClient } = renderWithdrawal();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    await click(container.querySelector('[data-testid="campaign-withdraw"]'));
    const cancel = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
      (button) => button.textContent === "Cancel",
    );
    await click(cancel ?? null);
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('[data-testid="campaign-withdraw"]')).not.toBeNull();
    expect(queryClient.getQueryData(keys[1])).toEqual(campaign);
    keys.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false));
    assertApply(container, true);
  });

  it("keeps the application and a retryable inline error when withdrawal returns 409", async () => {
    const message = "This drop has ended. Contact support for help.";
    const { container, queryClient } = renderWithdrawal(new ApiError("DROP_ENDED", message, 409));
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    await click(container.querySelector('[data-testid="campaign-withdraw"]'));
    await click(document.querySelector('[data-testid="campaign-withdraw-confirm"]'));
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(message);
    expect(document.querySelector('[data-testid="campaign-withdraw-confirm"]')?.hasAttribute("disabled")).toBe(false);
    expect(container.querySelector('[data-testid="campaign-withdraw"]')).not.toBeNull();
    expect(queryClient.getQueryData(keys[1])).toEqual(campaign);
    expect(invalidate).not.toHaveBeenCalled();
    assertApply(container, true);
    await click(document.querySelector('[data-testid="campaign-withdraw-confirm"]'));
    expect(mockApiFetch.mock.calls).toEqual([
      [`/api/campaigns/${campaign.id}/withdraw`, { method: "POST" }],
      [`/api/campaigns/${campaign.id}/withdraw`, { method: "POST" }],
    ]);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(message);
  });
});
