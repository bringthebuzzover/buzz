/**
 * Admin org erase uses an in-app type-to-confirm dialog, not window.prompt.
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
const mockSendEmailMutateAsync = jest.fn();
const mockAckMutateAsync = jest.fn();

jest.mock("../../api/hooks/useAdminHooks", () => ({
  useAdminOrg: (...args: unknown[]) => mockUseAdminOrg(...args),
  useAckIgBindMismatch: () => ({
    mutate: jest.fn(),
    mutateAsync: mockAckMutateAsync,
    isPending: false,
    isError: false,
  }),
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
  useSendOrgEmail: () => ({
    mutate: jest.fn(),
    mutateAsync: mockSendEmailMutateAsync,
    isPending: false,
    isError: false,
  }),
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
    claimedInstagramUsername: "lawrence_granda",
    igBindGraphUsername: null,
    igBindMismatchedAt: null,
    igBindMismatchAckedAt: null,
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
    mockAckMutateAsync.mockReset();
    mockAckMutateAsync.mockResolvedValue({});
    mockSendEmailMutateAsync.mockReset();
    mockSendEmailMutateAsync.mockResolvedValue({
      ok: true,
      to: "lg629@cornell.edu",
      cc: ["mc3237@cornell.edu"],
    });
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

  it("links claimed Instagram to the public profile", () => {
    mockUseAdminOrg.mockReturnValue({
      data: orgDetail(),
      isPending: false,
      isError: false,
    });
    renderPage();

    expect(document.body.textContent).toContain("Claimed handle");
    expect(document.body.textContent).toContain("Connected Instagram");
    const link = Array.from(container.querySelectorAll("a")).find(
      (el) => el.textContent === "@lawrence_granda",
    );
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe(
      "https://www.instagram.com/lawrence_granda/",
    );
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });

  it("acks an open bind mismatch without changing the connected handle", async () => {
    mockUseAdminOrg.mockReturnValue({
      data: {
        ...orgDetail(),
        instagramHandle: "otherclub",
        instagramUsername: "otherclub",
        claimedInstagramUsername: "lawrence_granda",
        igBindGraphUsername: "otherclub",
        igBindMismatchedAt: Date.now(),
        igBindMismatchAckedAt: null,
      },
      isPending: false,
      isError: false,
    });
    renderPage();

    expect(document.body.textContent).toContain("IG bind mismatch");
    expect(document.body.textContent).toContain(
      "This organization connected @otherclub after applying as @lawrence_granda.",
    );
    expect(document.body.textContent).not.toContain("Live handle is now");
    const ack = container.querySelector(
      '[data-testid="ack-ig-bind-mismatch"]',
    ) as HTMLButtonElement;
    expect(ack).toBeTruthy();
    await act(async () => {
      ack.click();
    });
    expect(mockAckMutateAsync).toHaveBeenCalledWith(
      "22222222-2222-2222-2222-222222222222",
    );
  });

  it("keeps the Connect snapshot in the mismatch panel after a later Graph rename", () => {
    mockUseAdminOrg.mockReturnValue({
      data: {
        ...orgDetail(),
        instagramHandle: "renamedclub",
        instagramUsername: "renamedclub",
        claimedInstagramUsername: "lawrence_granda",
        igBindGraphUsername: "otherclub",
        igBindMismatchedAt: Date.now(),
        igBindMismatchAckedAt: null,
      },
      isPending: false,
      isError: false,
    });
    renderPage();

    expect(document.body.textContent).toContain(
      "This organization connected @otherclub after applying as @lawrence_granda. Live handle is now @renamedclub.",
    );
  });

  it("asks for the connected handle on erase when claimed differs", () => {
    mockUseAdminOrg.mockReturnValue({
      data: {
        ...orgDetail(),
        instagramHandle: "otherclub",
        instagramUsername: "otherclub",
        claimedInstagramUsername: "lawrence_granda",
        igBindGraphUsername: "otherclub",
        igBindMismatchedAt: Date.now(),
        igBindMismatchAckedAt: null,
      },
      isPending: false,
      isError: false,
    });
    renderPage();
    act(() => {
      (
        container.querySelector('[data-testid="erase-org"]') as HTMLButtonElement
      ).click();
    });
    expect(document.body.textContent).toContain("Type @otherclub exactly");
    const submit = document.querySelector(
      '[data-testid="erase-org-submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const input = document.querySelector(
      '[data-testid="erase-org-confirm"]',
    ) as HTMLInputElement;
    act(() => {
      setInputValue(input, "@otherclub");
    });
    expect(submit.disabled).toBe(false);
  });

  it("opens an in-app confirm and does not POST until the handle matches", async () => {
    const promptSpy = jest.spyOn(window, "prompt");
    mockUseAdminOrg.mockReturnValue({
      data: orgDetail(),
      isPending: false,
      isError: false,
    });
    renderPage();

    const writeEmail = container.querySelector(
      '[data-testid="write-email"]',
    ) as HTMLButtonElement;
    expect(writeEmail).toBeTruthy();
    const erase = container.querySelector(
      '[data-testid="erase-org"]',
    ) as HTMLButtonElement;
    expect(erase.getAttribute("aria-label")).toBe("Erase organization");
    const viewAs = container.querySelector(
      '[data-testid="view-as"]',
    ) as HTMLButtonElement;
    expect(viewAs).toBeTruthy();
    act(() => {
      erase.click();
    });

    expect(promptSpy).not.toHaveBeenCalled();
    expect(mockEraseMutateAsync).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Erase this organization");
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    const submit = document.querySelector(
      '[data-testid="erase-org-submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const input = document.querySelector(
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

  it("clears the typed handle when the erase dialog is dismissed", () => {
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
    const input = document.querySelector(
      '[data-testid="erase-org-confirm"]',
    ) as HTMLInputElement;
    act(() => {
      setInputValue(input, "@lawrence_granda");
    });
    expect(input.value).toBe("@lawrence_granda");

    const cancel = document.querySelector(
      '[data-testid="erase-org-cancel"]',
    ) as HTMLButtonElement;
    act(() => {
      cancel.click();
    });
    expect(document.querySelector('[data-testid="erase-org-confirm"]')).toBeNull();

    act(() => {
      erase.click();
    });
    const reopened = document.querySelector(
      '[data-testid="erase-org-confirm"]',
    ) as HTMLInputElement;
    expect(reopened.value).toBe("");
  });

  it("opens compose with locked To/CC and requires a subject", async () => {
    mockUseAdminOrg.mockReturnValue({
      data: orgDetail(),
      isPending: false,
      isError: false,
    });
    renderPage();
    act(() => {
      (
        container.querySelector('[data-testid="write-email"]') as HTMLButtonElement
      ).click();
    });
    const to = document.querySelector(
      '[data-testid="compose-email-to"]',
    ) as HTMLInputElement;
    expect(to.value).toBe("lg629@cornell.edu");
    expect(to.readOnly).toBe(true);
    const cc = document.querySelector(
      '[data-testid="compose-email-cc"]',
    ) as HTMLInputElement;
    expect(cc.readOnly).toBe(true);
    expect(cc.value.length).toBeGreaterThan(0);
    const send = document.querySelector(
      '[data-testid="compose-email-send"]',
    ) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    const subject = document.querySelector(
      '[data-testid="compose-email-subject"]',
    ) as HTMLInputElement;
    act(() => {
      setInputValue(subject, "Hello from Buzz");
    });
    expect(send.disabled).toBe(false);
    await act(async () => {
      send.click();
    });
    expect(mockSendEmailMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "11111111-1111-1111-1111-111111111111",
        subject: "Hello from Buzz",
      }),
    );
  });
});
