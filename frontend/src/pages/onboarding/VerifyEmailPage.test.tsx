/**
 * Confirm-before-verify: load with ?token= must not POST until the button click
 * (org.verify-email-auto-consumes-token).
 *
 * Also covers pending-swap success copy for active / pending_approval sessions.
 *
 * Uses react-dom (no @testing-library/react in this package).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mockMutateAsync = jest.fn();
const mockRefreshUser = jest.fn(async () => null as null | {
  id: string;
  portalRole: "org";
  status: string;
  email: string | null;
  pendingEduEmail: string | null;
  instagramUsername: string | null;
});

jest.mock("../../api/hooks/useOnboardingHooks", () => ({
  useVerifyEmail: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useResendVerification: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useChangeEduEmail: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    status: "idle",
    user: null,
    refreshUser: mockRefreshUser,
  }),
}));

import VerifyEmailPage from "./VerifyEmailPage";

describe("VerifyEmailPage confirm-before-verify", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({ ok: true });
    mockRefreshUser.mockReset();
    mockRefreshUser.mockResolvedValue(null);
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

  function renderWithToken(token: string) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    act(() => {
      root.render(
        <MemoryRouter
          initialEntries={[`/onboarding/verify-email?token=${token}`]}
        >
          <QueryClientProvider client={queryClient}>
            <VerifyEmailPage />
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });
  }

  async function clickVerify() {
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      /verify email/i.test(b.textContent ?? ""),
    );
    expect(button).toBeTruthy();
    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
  }

  it("does not call verify until Verify email is clicked", async () => {
    renderWithToken("test-token-abc");

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();

    await clickVerify();

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith("test-token-abc");
  });

  it("shows portal success copy when session is active after verify", async () => {
    mockRefreshUser.mockResolvedValue({
      id: "u1",
      portalRole: "org",
      status: "active",
      email: "new@test.edu",
      pendingEduEmail: null,
      instagramUsername: "campus",
    });
    renderWithToken("tok-active");
    await clickVerify();

    expect(container.textContent).toContain(
      "Your school email is updated. You can continue using the org portal.",
    );
    expect(container.textContent).not.toContain("pending admin approval");
  });

  it("shows awaiting-approval copy when session is pending_approval", async () => {
    mockRefreshUser.mockResolvedValue({
      id: "u2",
      portalRole: "org",
      status: "pending_approval",
      email: "new@test.edu",
      pendingEduEmail: null,
      instagramUsername: "campus",
    });
    renderWithToken("tok-pa");
    await clickVerify();

    expect(container.textContent).toContain(
      "Your school email is confirmed. Your account is awaiting admin approval.",
    );
    expect(container.textContent).not.toContain(
      "Thanks! Your account is now pending admin approval",
    );
  });
});
