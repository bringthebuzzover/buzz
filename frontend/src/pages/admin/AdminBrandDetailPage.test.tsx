/**
 * Admin brand detail — Instagram handle links to the public profile.
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
  isError: false,
});

const mockUseAdminBrand = jest.fn();

jest.mock("../../api/hooks/useAdminHooks", () => ({
  useAdminBrand: (...args: unknown[]) => mockUseAdminBrand(...args),
  useApproveBrand: () => idleMutation(),
  useDenyBrand: () => idleMutation(),
  useResendBrandInvite: () => idleMutation(),
  useUndenyBrand: () => idleMutation(),
  useViewAs: () => ({
    viewAs: jest.fn(),
    error: null,
    isPending: false,
  }),
}));

import AdminBrandDetailPage from "./AdminBrandDetailPage";

function brandDetail() {
  return {
    id: "brand-1",
    userId: "user-1",
    brandName: "Acme",
    companyEmail: "acme@example.test",
    status: "approved",
    instagramHandle: "acme_brand",
    passwordSet: true,
    impersonatable: true,
    approvedAt: Date.now(),
    lastLoginAt: Date.now(),
    invite: {
      issuedAt: Date.now(),
      expiresAt: null,
      usedAt: Date.now(),
    },
    drops: [],
  };
}

describe("AdminBrandDetailPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockUseAdminBrand.mockReset();
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

  it("links Instagram to the public profile", () => {
    mockUseAdminBrand.mockReturnValue({
      data: brandDetail(),
      isPending: false,
      isError: false,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/admin/brands/brand-1"]}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route
                path="/admin/brands/:brandId"
                element={<AdminBrandDetailPage />}
              />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });

    const link = Array.from(container.querySelectorAll("a")).find(
      (el) => el.textContent === "@acme_brand",
    );
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe(
      "https://www.instagram.com/acme_brand/",
    );
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });
});
