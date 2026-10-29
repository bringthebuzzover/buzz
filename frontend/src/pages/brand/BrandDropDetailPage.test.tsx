/**
 * BrandDropDetailPage — creative editor gating and per-seat decisions.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mockUseBrandDropDetail = jest.fn();
const mockDecide = jest.fn();
const mockSend = jest.fn();

jest.mock("../../api/hooks/useBrandHooks", () => ({
  useBrandDropDetail: (...args: unknown[]) => mockUseBrandDropDetail(...args),
  useSetSeatDecision: () => ({ mutate: mockDecide, isPending: false, error: null }),
  useSendDecisions: () => ({ mutateAsync: mockSend, isPending: false, error: null }),
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
    stage: "applying",
    totalProductUnits: null,
    createdAt: now,
    campaignHashtag: null,
    applications: [],
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalEngagement: 0,
    totalReach: 0,
    brandCanEditCreative,
    publishedAt: now,
  };
}

describe("BrandDropDetailPage", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    mockUseBrandDropDetail.mockReset();
    mockDecide.mockReset();
    mockSend.mockReset().mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    } else {
      delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
    }
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
    expect(
      container.querySelector('[data-testid="copy-public-drop-url"]'),
    ).toBeTruthy();
  });

  it("shows drop KPIs once the drop is live", () => {
    mockUseBrandDropDetail.mockReturnValue({
      data: { ...brandDrop(false), stage: "live" },
      isLoading: false,
      error: null,
    });
    renderPage();
    expect(container.textContent).toContain("Total engagement");
  });

  it("hides the public URL until the drop is published", () => {
    mockUseBrandDropDetail.mockReturnValue({
      data: { ...brandDrop(false), publishedAt: null },
      isLoading: false,
      error: null,
    });
    renderPage();
    expect(
      container.querySelector('[data-testid="copy-public-drop-url"]'),
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

  it("renders one decision control as a stacked card below md", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
        onchange: null,
      }),
    });

    mockUseBrandDropDetail.mockReturnValue({
      data: {
        ...brandDrop(false),
        stage: "selecting",
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
            pitch: "We host weekly mixers.",
            decision: "applied",
            decisionAt: null,
            decisionSentAt: null,
            appliedAt: now,
            allocatedUnits: null,
            deliveryAddress: "Ithaca, NY",
            accountErased: false,
            shipments: [],
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

    const decision = container.querySelectorAll(
      'select[aria-label="Decision for Campus Greeks"]',
    );
    expect(decision).toHaveLength(1);
    expect(container.querySelector("table")).toBeNull();
    expect(container.textContent).toContain("We host weekly mixers.");
    expect(container.textContent).toContain("Ship to: Ithaca, NY");
  });

  it("shows a missing applicant address as Address pending in the warn tone", () => {
    mockUseBrandDropDetail.mockReturnValue({
      data: {
        ...brandDrop(false),
        stage: "selecting",
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
            decisionSentAt: null,
            appliedAt: now,
            allocatedUnits: null,
            deliveryAddress: null,
            accountErased: false,
            shipments: [],
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

    expect(container.textContent).toContain("Ship to: Address pending");
    const pending = container.querySelector('[data-testid="address-pending"]');
    expect(pending?.textContent).toBe("Address pending");
    expect(pending?.className).toContain("text-accent");
  });

  it("drafts a decision per seat, then sends through the in-app confirm", async () => {
    const confirmSpy = jest.spyOn(window, "confirm");
    const seat = {
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
      decisionSentAt: null,
      appliedAt: now,
      allocatedUnits: null,
      deliveryAddress: "Ithaca, NY",
      accountErased: false,
      shipments: [],
      attributedComments: 0,
      attributedEngagement: 0,
      attributedLikes: 0,
      attributedPostCount: 0,
      posts: [],
    };
    const detail = (decision: string) => ({
      data: {
        ...brandDrop(false),
        stage: "selecting",
        applyCloseAt: now - 1000,
        applications: [{ ...seat, decision }],
      },
      isLoading: false,
      error: null,
    });
    mockUseBrandDropDetail.mockReturnValue(detail("applied"));
    renderPage();

    const select = container.querySelector(
      'select[aria-label="Decision for Campus Greeks"]',
    ) as HTMLSelectElement;
    expect(
      (container.querySelector('[data-testid="send-decisions"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    act(() => {
      select.value = "accepted";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(mockDecide).toHaveBeenCalledWith({
      applicationId: "app-1",
      decision: "accepted",
      allocatedUnits: null,
    });

    // The draft comes back from the server; Send is now live.
    mockUseBrandDropDetail.mockReturnValue(detail("accepted"));
    renderPage();
    expect(container.textContent).toContain("Ready to send: accept 1 · deny 0");
    const start = container.querySelector(
      '[data-testid="send-decisions"]',
    ) as HTMLButtonElement;
    act(() => {
      start.click();
    });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    // The confirm dialog portals to <body>.
    expect(document.body.textContent).toContain("sent decisions can't be changed");

    const confirmBtn = document.querySelector(
      '[data-testid="send-decisions-confirm"]',
    ) as HTMLButtonElement;
    await act(async () => {
      confirmBtn.click();
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Decisions sent.");
    confirmSpy.mockRestore();
  });

  it("omits an erased org from the applicant list", () => {
    mockUseBrandDropDetail.mockReturnValue({
      data: {
        ...brandDrop(false),
        stage: "selecting",
        applyCloseAt: now - 1000,
        applications: [
          {
            id: "app-1",
            dropId: "drop-1",
            orgId: "org-1",
            orgName: "Deleted organization",
            university: "Cornell University",
            instagramHandle: "",
            category: "fraternity",
            followerCount: 100,
            memberCount: 40,
            pitch: null,
            decision: "applied",
            decisionAt: null,
            decisionSentAt: null,
            appliedAt: now,
            allocatedUnits: null,
            deliveryAddress: null,
            accountErased: true,
            shipments: [],
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

    expect(container.textContent).not.toContain("Deleted organization");
    expect(container.textContent).not.toContain("Cornell University");
    expect(container.textContent).not.toContain("Shipping details removed");
    expect(container.textContent).not.toContain("Account deleted");
  });
});
