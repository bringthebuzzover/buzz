/**
 * AdminDropRequestDetailPage — Publish stays disabled until required fields.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mockUseAdminDropRequest = jest.fn();
const mockUseAdminDrop = jest.fn();

jest.mock("../../api/hooks/useAdminHooks", () => ({
  useAdminDropRequest: (...args: unknown[]) => mockUseAdminDropRequest(...args),
  useAdminDrop: (...args: unknown[]) => mockUseAdminDrop(...args),
  useCreateAdminDrop: () => ({
    mutateAsync: jest.fn().mockResolvedValue({
      id: "drop-1",
      publishedAt: null,
    }),
    isPending: false,
  }),
  usePatchAdminDropConfig: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  usePublishDrop: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

import AdminDropRequestDetailPage from "./AdminDropRequestDetailPage";

const now = Date.now();

const openTicket = {
  id: "req-1",
  brandId: "brand-1",
  brandName: "Acme",
  message: "Want a spring drop",
  notes: null,
  status: "received",
  convertedDropId: null as string | null,
  createdAt: now,
  updatedAt: now,
};

function linkedDrop(publishedAt: number | null) {
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
    applyOpenAt: now + 86400000,
    applyCloseAt: now + 8 * 86400000,
    manualReopen: false,
    stage: "request_received",
    trackingNumber: null,
    totalProductUnits: null,
    campaignHashtag: null,
    finalizedAt: null,
    publishedAt,
    dropRequestId: "req-1",
    createdAt: now,
    allocatedUnits: 0,
    linkedPostCount: 0,
    pendingSuggestionCount: 0,
    applicants: [],
    trackerEvents: [],
    brandCanEditCreative: false,
  };
}

describe("AdminDropRequestDetailPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockUseAdminDropRequest.mockReturnValue({
      data: { ...openTicket },
      isPending: false,
      isError: false,
    });
    mockUseAdminDrop.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
    });
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

  it("disables Publish until a draft exists with required fields", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/admin/requests/req-1"]}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route
                path="/admin/requests/:requestId"
                element={<AdminDropRequestDetailPage />}
              />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });

    expect(container.querySelector('[data-testid="publish-drop"]')).toBeNull();
    const stub = Array.from(container.querySelectorAll("button")).find(
      (el) => el.textContent === "Publish",
    ) as HTMLButtonElement | undefined;
    expect(stub).toBeTruthy();
    expect(stub!.disabled).toBe(true);

    const save = container.querySelector(
      '[data-testid="save-draft"]',
    ) as HTMLButtonElement | null;
    expect(save).toBeTruthy();
    expect(save!.disabled).toBe(true);
  });

  function setInput(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function fillRequired(container: HTMLElement, image: string) {
    setInput(
      container.querySelector('[data-testid="draft-title"]') as HTMLInputElement,
      "Spring Drop",
    );
    setInput(
      container.querySelector(
        '[data-testid="draft-description"]',
      ) as HTMLTextAreaElement,
      "Real campaign",
    );
    setInput(
      container.querySelector('[data-testid="draft-image"]') as HTMLInputElement,
      image,
    );
    setInput(
      container.querySelector('[data-testid="draft-location"]') as HTMLInputElement,
      "Bay Area",
    );
  }

  it("keeps Save draft disabled for http and placehold.co images", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/admin/requests/req-1"]}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route
                path="/admin/requests/:requestId"
                element={<AdminDropRequestDetailPage />}
              />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });

    const save = () =>
      container.querySelector('[data-testid="save-draft"]') as HTMLButtonElement;

    act(() => {
      fillRequired(container, "http://cdn.example.test/hero.png");
    });
    expect(save().disabled).toBe(true);

    act(() => {
      fillRequired(container, "https://placehold.co/600x400/png");
    });
    expect(save().disabled).toBe(true);

    act(() => {
      fillRequired(container, "https://cdn.example.test/hero.png");
    });
    expect(save().disabled).toBe(false);
  });

  it("enables Publish after Save draft returns a drop", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/admin/requests/req-1"]}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route
                path="/admin/requests/:requestId"
                element={<AdminDropRequestDetailPage />}
              />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });

    act(() => {
      fillRequired(container, "https://cdn.example.test/hero.png");
    });
    const save = container.querySelector(
      '[data-testid="save-draft"]',
    ) as HTMLButtonElement;
    expect(save.disabled).toBe(false);

    await act(async () => {
      save.click();
    });

    const publish = container.querySelector(
      '[data-testid="publish-drop"]',
    ) as HTMLButtonElement | null;
    expect(publish).toBeTruthy();
    expect(publish!.disabled).toBe(false);
  });

  it("keeps draft-title / save-draft / publish-drop for an unpublished converted drop", () => {
    mockUseAdminDropRequest.mockReturnValue({
      data: {
        ...openTicket,
        status: "converted",
        convertedDropId: "drop-1",
      },
      isPending: false,
      isError: false,
    });
    mockUseAdminDrop.mockReturnValue({
      data: linkedDrop(null),
      isPending: false,
      isError: false,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/admin/requests/req-1"]}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route
                path="/admin/requests/:requestId"
                element={<AdminDropRequestDetailPage />}
              />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });

    expect(container.querySelector('[data-testid="draft-title"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="save-draft"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="publish-drop"]')).toBeTruthy();
  });

  it("hides the draft form after publish and links to drop Config", () => {
    mockUseAdminDropRequest.mockReturnValue({
      data: {
        ...openTicket,
        status: "converted",
        convertedDropId: "drop-1",
      },
      isPending: false,
      isError: false,
    });
    mockUseAdminDrop.mockReturnValue({
      data: linkedDrop(now),
      isPending: false,
      isError: false,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/admin/requests/req-1"]}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route
                path="/admin/requests/:requestId"
                element={<AdminDropRequestDetailPage />}
              />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });

    expect(container.querySelector('[data-testid="draft-title"]')).toBeNull();
    expect(container.querySelector('[data-testid="save-draft"]')).toBeNull();
    expect(container.querySelector('[data-testid="publish-drop"]')).toBeNull();
    const configLink = Array.from(container.querySelectorAll("a")).find((el) =>
      (el.getAttribute("href") ?? "").includes("tab=config"),
    );
    expect(configLink).toBeTruthy();
  });
});
