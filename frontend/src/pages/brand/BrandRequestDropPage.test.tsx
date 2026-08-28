/**
 * BrandRequestDropPage — submits drop-requests shape and navigates to dashboard
 * (not /brand/drops/:id).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mockMutate = jest.fn();

jest.mock("../../api/hooks/useBrandHooks", () => ({
  useCreateBrandDropRequest: () => ({
    mutate: mockMutate,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

import BrandRequestDropPage from "./BrandRequestDropPage";

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.hash}
    </div>
  );
}

describe("BrandRequestDropPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockMutate.mockReset();
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
        <MemoryRouter initialEntries={["/brand/requests/new"]}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route path="/brand/requests/new" element={<BrandRequestDropPage />} />
              <Route
                path="/brand/dashboard"
                element={
                  <div>
                    Dashboard
                    <LocationProbe />
                  </div>
                }
              />
              <Route
                path="/brand/drops/:dropId"
                element={
                  <div>
                    Drop detail
                    <LocationProbe />
                  </div>
                }
              />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });
  }

  it("submits message/notes to drop-requests and does not navigate to /brand/drops/", async () => {
    mockMutate.mockImplementation((_body, opts) => {
      opts?.onSuccess?.({
        id: "req-1",
        brandId: "b-1",
        message: "Spring campus push",
        notes: "Prefer southeast",
        status: "received",
        convertedDropId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    renderPage();

    const message = container.querySelector("#message") as HTMLTextAreaElement;
    const notes = container.querySelector("#notes") as HTMLTextAreaElement;
    const form = container.querySelector("form") as HTMLFormElement;
    expect(message).toBeTruthy();
    expect(notes).toBeTruthy();

    await act(async () => {
      message.value = "Spring campus push";
      message.dispatchEvent(new Event("input", { bubbles: true }));
      notes.value = "Prefer southeast";
      notes.dispatchEvent(new Event("input", { bubbles: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0]).toEqual({
      message: "Spring campus push",
      notes: "Prefer southeast",
    });

    await act(async () => {
      await Promise.resolve();
    });

    const locationEl = container.querySelector('[data-testid="location"]');
    expect(locationEl?.textContent).toContain("/brand/dashboard");
    expect(locationEl?.textContent).not.toContain("/brand/drops/");
  });
});
