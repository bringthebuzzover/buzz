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
      container.querySelector('[data-testid="brand-can-edit-creative"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="save-drop-config"]'),
    ).toBeTruthy();
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
  });
});
