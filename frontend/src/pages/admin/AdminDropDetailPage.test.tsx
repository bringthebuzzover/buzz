/**
 * AdminDropDetailPage — Config is default for drafts; applicants for published.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const idleMutation = () => ({
  mutate: jest.fn(),
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
});

const mockUseAdminDrop = jest.fn();

jest.mock("../../api/hooks/useAdminHooks", () => ({
  useAdminDrop: (...args: unknown[]) => mockUseAdminDrop(...args),
  useAdvanceTracker: () => idleMutation(),
  useClearReopen: () => idleMutation(),
  usePatchAdminDropConfig: () => idleMutation(),
  usePublishDrop: () => idleMutation(),
  useReopenDrop: () => idleMutation(),
  useSetDropTracking: () => idleMutation(),
  useHideDrop: () => idleMutation(),
  useUnhideDrop: () => idleMutation(),
}));

import AdminDropDetailPage from "./AdminDropDetailPage";

const now = Date.now();

function adminDrop(overrides: Record<string, unknown> = {}) {
  return {
    id: "drop-1",
    brandId: "brand-1",
    brandName: "Acme",
    brandStatus: "approved",
    brandInstagramHandle: null,
    title: "Spring Drop",
    description: "Real campaign",
    image: "https://cdn.example.test/hero.png",
    location: "Bay Area",
    capacityTotal: 8,
    applyOpenAt: now,
    applyCloseAt: now + 7 * 24 * 60 * 60 * 1000,
    manualReopen: false,
    stage: "request_received",
    trackingNumber: null,
    totalProductUnits: null,
    campaignHashtag: null,
    finalizedAt: null,
    publishedAt: null,
    hiddenAt: null,
    dropRequestId: null,
    createdAt: now,
    allocatedUnits: 0,
    linkedPostCount: 0,
    pendingSuggestionCount: 0,
    applicants: [],
    trackerEvents: [],
    brandCanEditCreative: false,
    ...overrides,
  };
}

describe("AdminDropDetailPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockUseAdminDrop.mockReset();
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

  function renderAt(path: string) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    act(() => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route
                path="/admin/drops/:dropId"
                element={<AdminDropDetailPage />}
              />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });
  }

  it("defaults to Config for an unpublished draft and shows who-can-edit", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: null }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");

    expect(
      container.querySelector('[data-testid="tab-config"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="tab-tracker"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="tracker-advance"]')).toBeNull();
    expect(container.textContent).toContain("Campaign");
    expect(
      container.querySelector('[data-testid="brand-can-edit-creative"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="save-drop-config"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="hide-drop"]')).toBeFalsy();
    const hero = container.querySelector(
      'img[src="https://cdn.example.test/hero.png"]',
    );
    expect(hero?.parentElement?.className).toContain("aspect-video");
    expect(container.querySelector("#drop-config-description")).toBeTruthy();
  });

  it("defaults to Applicants for a published drop; Config holds the checkbox", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");

    expect(
      container.querySelector('[data-testid="tab-applicants"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="brand-can-edit-creative"]'),
    ).toBeNull();

    const configTab = container.querySelector(
      '[data-testid="tab-config"]',
    ) as HTMLButtonElement;
    expect(configTab).toBeTruthy();
    act(() => {
      configTab.click();
    });
    expect(
      container.querySelector('[data-testid="brand-can-edit-creative"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="hide-drop"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="hide-drop-confirm"]')).toBeNull();
    expect(container.querySelector('[data-testid="drop-unhide"]')).toBeFalsy();

    const trackerTab = container.querySelector(
      '[data-testid="tab-tracker"]',
    ) as HTMLButtonElement;
    act(() => {
      trackerTab.click();
    });
    expect(
      container.querySelector('[data-testid="tracker-advance"]'),
    ).toBeTruthy();
  });

  it("shows follower count and city/state ship-to on Applicants", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({
        publishedAt: now,
        applicants: [
          {
            id: "app-1",
            orgId: "org-1",
            userId: "user-1",
            orgName: "Theta",
            university: "Berkeley",
            instagramHandle: "theta",
            followerCount: 1262,
            deliveryAddress: "2301 Bancroft Way, Berkeley, CA 94720",
            shippingCity: "Berkeley",
            shippingState: "CA",
            accountErased: false,
            decision: "accepted",
            allocatedUnits: 2,
            pitch: null,
            trackingNumber: null,
            linkedPostCount: 0,
            appliedAt: now,
            decisionAt: now,
          },
        ],
      }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");

    expect(container.textContent).toContain("Followers");
    expect(container.textContent).toContain("1.3K");
    expect(container.textContent).toContain("Berkeley, CA");
    expect(container.textContent).not.toContain("2301 Bancroft Way");
  });

  it("does not restamp Account deleted next to a tombstone org name", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({
        publishedAt: now,
        applicants: [
          {
            id: "app-2",
            orgId: "org-2",
            userId: "user-2",
            orgName: "Deleted organization",
            university: "Cornell University",
            instagramHandle: null,
            followerCount: 100,
            deliveryAddress: null,
            shippingCity: null,
            shippingState: null,
            accountErased: true,
            decision: "denied",
            allocatedUnits: null,
            pitch: null,
            trackingNumber: null,
            linkedPostCount: 0,
            appliedAt: now,
            decisionAt: now,
          },
        ],
      }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");

    expect(container.textContent).toContain("Deleted organization");
    expect(container.textContent).toContain("Cornell University");
    expect(container.textContent).not.toContain("Account deleted");
  });

  it("opens a hide dialog that asks the admin to type hide", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");

    const trigger = container.querySelector(
      '[data-testid="hide-drop"]',
    ) as HTMLButtonElement;
    act(() => {
      trigger.click();
    });
    expect(
      document.querySelector('[data-testid="hide-drop-confirm"]'),
    ).toBeTruthy();
    expect(document.body.textContent).toContain('Type "hide" to confirm');
    const submit = document.querySelector(
      '[data-testid="hide-drop-submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("clears the brand-email checkbox when the hide dialog is dismissed", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");

    const trigger = container.querySelector(
      '[data-testid="hide-drop"]',
    ) as HTMLButtonElement;
    act(() => {
      trigger.click();
    });
    const box = document.querySelector(
      '[data-testid="hide-drop-notify-brand"]',
    ) as HTMLInputElement;
    expect(box.checked).toBe(false);
    act(() => {
      box.click();
    });
    expect(box.checked).toBe(true);
    const cancel = Array.from(document.querySelectorAll("button")).find(
      (el) => el.textContent === "Cancel",
    ) as HTMLButtonElement;
    act(() => {
      cancel.click();
    });
    act(() => {
      trigger.click();
    });
    const reopened = document.querySelector(
      '[data-testid="hide-drop-notify-brand"]',
    ) as HTMLInputElement;
    expect(reopened.checked).toBe(false);
  });

  it("shows unhide when the drop is hidden", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now, hiddenAt: now }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");
    expect(container.querySelector('[data-testid="drop-unhide"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="hide-drop"]')).toBeFalsy();
  });
});
