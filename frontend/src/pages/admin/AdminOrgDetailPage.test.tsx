/**
 * Admin org erase uses an in-app type-to-confirm, not window.prompt.
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

const mockUseAdminOrg = jest.fn();
const mockEraseMutateAsync = jest.fn();

jest.mock("../../api/hooks/useAdminHooks", () => ({
  useAdminOrg: (...args: unknown[]) => mockUseAdminOrg(...args),
  useApproveOrg: () => idleMutation(),
  useClearOrgInstagramToken: () => idleMutation(),
  useDenyOrg: () => idleMutation(),
  useEraseOrg: () => ({
    mutate: jest.fn(),
    mutateAsync: mockEraseMutateAsync,
    isPending: false,
    isError: false,
  }),
  useResendOrgConnect: () => idleMutation(),
  useUndenyOrg: () => idleMutation(),
  useViewAs: () => ({
    viewAs: jest.fn(),
    error: null,
    isPending: false,
  }),
}));

import AdminOrgDetailPage from "./AdminOrgDetailPage";

function orgDetail() {
  return {
    userId: "11111111-1111-1111-1111-111111111111",
    orgId: "22222222-2222-2222-2222-222222222222",
    status: "active",
    orgName: "Lawrence's Test",
    university: "Cornell University",
    instagramHandle: "lawrence_granda",
    instagramHandleConfirmed: false,
    instagramUsername: "lawrence_granda",
    instagramTokenExpiresAt: Date.now() + 86400000,
    instagramTokenRefreshedAt: Date.now(),
    impersonatable: true,
    eduEmail: "lg629@cornell.edu",
    emailVerifiedAt: Date.now(),
    approvedAt: Date.now(),
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    tiktokHandle: null,
    category: null,
    followerCount: 1262,
    memberCount: 1,
    city: null,
    state: null,
    contactName: null,
    deliveryAddress: null,
    postCount: 0,
    linkedPostCount: 0,
    applications: { applied: 0, accepted: 0, denied: 0 },
    verification: {
      liveTokenCount: 0,
      latestExpiresAt: null,
      latestUsedAt: null,
    },
  };
}

function setInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("AdminOrgDetailPage erase confirm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockUseAdminOrg.mockReset();
    mockEraseMutateAsync.mockReset();
    mockEraseMutateAsync.mockResolvedValue({
      emailSent: true,
      emailToDomain: "cornell.edu",
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

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    act(() => {
      root.render(
        <MemoryRouter
          initialEntries={[
            "/admin/orgs/11111111-1111-1111-1111-111111111111",
          ]}
        >
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route
                path="/admin/orgs/:userId"
                element={<AdminOrgDetailPage />}
              />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });
  }

  it("opens an in-app confirm and does not POST until the handle matches", async () => {
    const promptSpy = jest.spyOn(window, "prompt");
    mockUseAdminOrg.mockReturnValue({
      data: orgDetail(),
      isPending: false,
      isError: false,
    });
    renderPage();

    const erase = container.querySelector(
      '[data-testid="erase-org"]',
    ) as HTMLButtonElement;
    act(() => {
      erase.click();
    });

    expect(promptSpy).not.toHaveBeenCalled();
    expect(mockEraseMutateAsync).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Erase this organization");

    const submit = container.querySelector(
      '[data-testid="erase-org-submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const input = container.querySelector(
      '[data-testid="erase-org-confirm"]',
    ) as HTMLInputElement;
    act(() => {
      setInputValue(input, "@lawrence_granda");
    });
    expect(submit.disabled).toBe(false);

    await act(async () => {
      submit.click();
    });
    expect(mockEraseMutateAsync).toHaveBeenCalledWith({
      userId: "11111111-1111-1111-1111-111111111111",
      confirm: "@lawrence_granda",
    });
    promptSpy.mockRestore();
  });
});
