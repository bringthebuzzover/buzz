/**
 * AdminDropRequestDetailPage — Publish stays disabled until required fields.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

jest.mock("../../api/hooks/useAdminHooks", () => ({
  useAdminDropRequest: () => ({
    data: {
      id: "req-1",
      brandId: "brand-1",
      brandName: "Acme",
      message: "Want a spring drop",
      notes: null,
      status: "received",
      convertedDropId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    isPending: false,
    isError: false,
  }),
  useAdminDrop: () => ({
    data: undefined,
    isPending: false,
    isError: false,
  }),
  useCreateAdminDrop: () => ({
    mutateAsync: jest.fn(),
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

describe("AdminDropRequestDetailPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

    const publish = container.querySelector(
      '[data-testid="publish-drop"]',
    ) as HTMLButtonElement | null;
    expect(publish).toBeTruthy();
    expect(publish!.disabled).toBe(true);

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
});
