/**
 * BrandDropDetailPage — Campaign creative editor only when brandCanEditCreative.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mockUseBrandDropDetail = jest.fn();
const mockFinalizeMutate = jest.fn();

jest.mock("../../api/hooks/useBrandHooks", () => ({
  useBrandDropDetail: (...args: unknown[]) => mockUseBrandDropDetail(...args),
  useFinalizeApplicants: () => ({
    mutate: mockFinalizeMutate,
    isPending: false,
  }),
  usePatchBrandDropCreative: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

import BrandDropDetailPage from "./BrandDropDetailPage";

const now = Date.now();

function brandDrop(brandCanEditCreative: boolean) {
  return {
    id: "drop-1",
    brandId: "brand-1",
    brandName: "Acme",
    title: "Spring Drop",
    description: "Campaign copy",
    image: "https://cdn.example.test/hero.png",
    location: "Bay Area",
    capacityTotal: 8,
    applyOpenAt: now - 86400000,
    applyCloseAt: now + 7 * 86400000,
    manualReopen: false,
    brandTrackerStage: "request_received",
    totalProductUnits: null,
    applicantSelectionFinalizedAt: null,
    createdAt: now,
    trackingNumber: null,
    campaignHashtag: null,
    applications: [],
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalEngagement: 0,
    totalReach: 0,
    brandCanEditCreative,
  };
}

describe("BrandDropDetailPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockUseBrandDropDetail.mockReset();
    mockFinalizeMutate.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/brand/drops/drop-1"]}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route
                path="/brand/drops/:dropId"
                element={<BrandDropDetailPage />}
              />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });
  }

  it("hides the campaign editor when brandCanEditCreative is false", () => {
    mockUseBrandDropDetail.mockReturnValue({
      data: brandDrop(false),
      isLoading: false,
      error: null,
    });
    renderPage();

    expect(container.textContent).toContain("Spring Drop");
    expect(
      container.querySelector('[data-testid="brand-campaign-editor"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="brand-save-creative"]'),
    ).toBeNull();
  });

  it("shows the campaign editor when brandCanEditCreative is true", () => {
    mockUseBrandDropDetail.mockReturnValue({
      data: brandDrop(true),
      isLoading: false,
      error: null,
    });
    renderPage();

    expect(
      container.querySelector('[data-testid="brand-campaign-editor"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="brand-save-creative"]'),
    ).toBeTruthy();
  });

  it("asks for in-app finalize confirm instead of window.confirm", () => {
    const confirmSpy = jest.spyOn(window, "confirm");
    mockUseBrandDropDetail.mockReturnValue({
      data: {
        ...brandDrop(false),
        brandTrackerStage: "finalizing_agreements",
        applyCloseAt: now - 1000,
        applications: [
          {
            id: "app-1",
            dropId: "drop-1",
            orgId: "org-1",
            orgName: "Campus Greeks",
            university: "Cornell",
            instagramHandle: "campusgreeks",
            category: "fraternity",
            followerCount: 100,
            memberCount: 40,
            pitch: null,
            decision: "applied",
            decisionAt: null,
            appliedAt: now,
            allocatedUnits: null,
            deliveryAddress: "Ithaca, NY",
            accountErased: false,
            trackingNumber: null,
            attributedComments: 0,
            attributedEngagement: 0,
            attributedLikes: 0,
            attributedPostCount: 0,
            posts: [],
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    renderPage();

    const start = container.querySelector(
      '[data-testid="finalize-selection"]',
    ) as HTMLButtonElement;
    act(() => {
      start.click();
    });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockFinalizeMutate).not.toHaveBeenCalled();
    expect(container.textContent).toContain("cannot be undone");

    const confirmBtn = container.querySelector(
      '[data-testid="finalize-confirm"]',
    ) as HTMLButtonElement;
    act(() => {
      confirmBtn.click();
    });
    expect(mockFinalizeMutate).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });
});
