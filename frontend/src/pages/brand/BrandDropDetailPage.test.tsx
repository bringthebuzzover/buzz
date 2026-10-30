/**
 * BrandDropDetailPage — creative editor gating and per-seat decisions.
 */
import { act } from "react";
import { renderWithProviders } from "../../testUtils";
import { ApiError } from "../../api/errors";
import BrandDropDetailPage from "./BrandDropDetailPage";

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
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    mockUseBrandDropDetail.mockReset();
    mockDecide.mockReset();
    mockSend.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    } else {
      delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
    }
  });

  function renderPage() {
    container = renderWithProviders(<BrandDropDetailPage />, {
      route: "/brand/drops/drop-1",
      path: "/brand/drops/:dropId",
    }).container;
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
            decision: "accepted",
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

  it("shows a missing accepted address as Address pending in the warn tone", () => {
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
            decision: "accepted",
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

  it("keeps a failed send open with the error in the dialog and no success banner", async () => {
    mockSend.mockRejectedValueOnce(new ApiError("FAILED", "Send failed.", 500));
    mockUseBrandDropDetail.mockReturnValue({
      data: {
        ...brandDrop(false),
        stage: "selecting",
        applyCloseAt: now - 1000,
        applications: [{ id: "app-1", orgName: "Test Org", decision: "denied", decisionSentAt: null }],
      },
      isLoading: false,
      error: null,
    });
    renderPage();
    act(() => (container.querySelector('[data-testid="send-decisions"]') as HTMLButtonElement).click());
    await act(async () => {
      (document.querySelector('[data-testid="send-decisions-confirm"]') as HTMLButtonElement).click();
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent)
      .toBe("Send failed.");
    expect(container.textContent).not.toContain("Decisions sent");
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

  it("lists applicants read-only while applications are open", () => {
    const applicant = (id: string, orgName: string, decision: string) => ({
      id,
      dropId: "drop-1",
      orgId: `org-${id}`,
      orgName,
      university: "Cornell University",
      instagramHandle: "@org",
      category: "fraternity",
      followerCount: 100,
      memberCount: 40,
      pitch: "We love it",
      decision,
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
    });
    const closeAt = Date.UTC(2026, 10, 10, 12);
    mockUseBrandDropDetail.mockReturnValue({
      data: {
        ...brandDrop(false),
        applyCloseAt: closeAt,
        applications: [applicant("a", "Alpha", "applied"), applicant("b", "Gone", "withdrew")],
      },
      isLoading: false,
      error: null,
    });
    renderPage();

    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).not.toContain("Gone");
    expect(container.textContent).toContain("You can choose once applications close on Nov 10.");
    expect(container.querySelector('[data-testid="decision-a"]')).toBeNull();
    expect(container.querySelector('[data-testid="send-decisions"]')).toBeNull();
  });
});
