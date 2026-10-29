/**
 * Bootstrap must never leave status as "authenticating" forever when it still
 * owns the auth generation (RequireAuth would spin on Loading — exit-impersonation
 * flake: /admin with no Overview and no login form).
 *
 * Password login claims the generation via acceptSession before installing the
 * token, so a late failing bootstrap must not set error over that session.
 *
 * Uses react-dom (no @testing-library/react in this package).
 */
import { act } from "react";
import { flushPromises, renderWithProviders } from "../testUtils";
import {
  AuthProvider,
  useAuth,
  type AuthUser,
} from "./AuthContext";

jest.mock("../api/auth", () => {
  const actual = jest.requireActual("../api/auth") as typeof import("../api/auth");
  return {
    ...actual,
    refreshAccessToken: jest.fn(),
    fetchMe: jest.fn(),
    devLogin: jest.fn(),
    logout: jest.fn(async () => {}),
    resumeImpersonation: jest.fn(),
    resumeViewAs: jest.fn(async () => "none" as const),
    endViewAsIntent: jest.fn(async () => {}),
    takeRefreshedUser: jest.fn(() => null),
    takeImpersonatedUser: jest.fn(() => null),
  };
});

import {
  clearViewAsLatch,
  fetchMe,
  getAccessToken,
  notifyApiSessionLost,
  peekViewAsLatch,
  refreshAccessToken,
  VIEW_AS_LATCH,
  resumeImpersonation,
  resumeViewAs,
  endViewAsIntent,
  setAccessToken,
  setViewAsLatch,
  takeImpersonatedUser,
  takeRefreshedUser,
} from "../api/auth";

const refreshMock = refreshAccessToken as jest.MockedFunction<
  typeof refreshAccessToken
>;
const fetchMeMock = fetchMe as jest.MockedFunction<typeof fetchMe>;
const resumeMock = resumeImpersonation as jest.MockedFunction<
  typeof resumeImpersonation
>;
const endViewAsMock = endViewAsIntent as jest.MockedFunction<
  typeof endViewAsIntent
>;
const resumeViewAsMock = resumeViewAs as jest.MockedFunction<typeof resumeViewAs>;
const devLoginMock = jest.requireMock("../api/auth").devLogin as jest.Mock;
const takeRefreshedUserMock = takeRefreshedUser as jest.MockedFunction<
  typeof takeRefreshedUser
>;
const takeImpersonatedUserMock = takeImpersonatedUser as jest.MockedFunction<
  typeof takeImpersonatedUser
>;

function Probe() {
  const {
    status,
    user,
    acceptSession,
    retryRestore,
    restoreAdminFromCookie,
    refreshUser,
  } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.id ?? ""}</span>
      <button
        type="button"
        data-testid="accept"
        onClick={() =>
          acceptSession(
            {
              id: "login-user",
              portalRole: "admin",
              status: "active",
            } as AuthUser,
            "login-access-token",
          )
        }
      >
        accept
      </button>
      <button
        type="button"
        data-testid="retry"
        onClick={() => {
          void retryRestore();
        }}
      >
        retry
      </button>
      <button
        type="button"
        data-testid="restore-admin"
        onClick={() => {
          void restoreAdminFromCookie();
        }}
      >
        restore-admin
      </button>
      <button
        type="button"
        data-testid="refresh-user"
        onClick={() => {
          void refreshUser();
        }}
      >
        refresh-user
      </button>
    </div>
  );
}

describe("AuthProvider bootstrap resolution", () => {
  let container: HTMLDivElement;

  async function mountAuth() {
    container = renderWithProviders(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
      { router: false },
    ).container;
    await flushPromises();
  }

  beforeEach(() => {
    refreshMock.mockReset();
    fetchMeMock.mockReset();
    resumeMock.mockReset();
    resumeViewAsMock.mockReset();
    resumeViewAsMock.mockResolvedValue("none");
    endViewAsMock.mockReset();
    endViewAsMock.mockResolvedValue(undefined);
    devLoginMock.mockReset();
    takeRefreshedUserMock.mockReset();
    takeRefreshedUserMock.mockReturnValue(null);
    takeImpersonatedUserMock.mockReset();
    takeImpersonatedUserMock.mockReturnValue(null);
    setAccessToken(null);
    clearViewAsLatch();
    window.history.pushState({}, "", "/admin");
  });

  afterEach(() => {
    setAccessToken(null);
    clearViewAsLatch();
  });

  it("ends in restore_failed (not hung authenticating) when refresh ok but /me never yields a user", async () => {
    refreshMock.mockResolvedValue(true);
    // Simulate a token from refresh so soft-fail paths that check getAccessToken work.
    refreshMock.mockImplementation(async () => {
      setAccessToken("refreshed-token");
      return true;
    });
    fetchMeMock.mockResolvedValue({ kind: "error" });

    await mountAuth();

    await waitForStatus(container, "restore_failed");
    expect(getAccessToken()).toBe("refreshed-token");
    expect(fetchMeMock).toHaveBeenCalledTimes(2);
  });

  it("soft-fails after successful devLogin when /me errors (keeps token)", async () => {
    refreshMock.mockResolvedValue(false);
    devLoginMock.mockImplementation(async () => {
      setAccessToken("dev-token");
      return { access_token: "dev-token" };
    });
    fetchMeMock.mockResolvedValue({ kind: "error" });
    window.history.pushState({}, "", "/org/browse");

    await mountAuth();

    await waitForStatus(container, "restore_failed");
    expect(getAccessToken()).toBe("dev-token");
    expect(fetchMeMock).toHaveBeenCalledTimes(2);
  });

  it("uses the user from /refresh and skips /me on the bootstrap refresh path (auth.ci-session-restore-flake v4)", async () => {
    // Same-transaction user body eliminates the mint-then-read race — no /me
    // call is expected on the refresh-success branch when refresh returned a
    // user.
    refreshMock.mockImplementation(async () => {
      setAccessToken("refresh-token");
      return true;
    });
    takeRefreshedUserMock.mockReturnValueOnce({
      id: "admin-1",
      portalRole: "admin",
      status: "active",
    });

    await mountAuth();

    await waitForStatus(container, "authenticated");
    expect(userText(container)).toBe("admin-1");
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(fetchMeMock).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe("refresh-token");
  });

  it("falls back to /me when /refresh succeeds but user is not surfaced (older response / mock)", async () => {
    refreshMock.mockImplementation(async () => {
      setAccessToken("refresh-token");
      return true;
    });
    // takeRefreshedUser defaults to null in beforeEach → forces /me fallback.
    fetchMeMock.mockResolvedValue({
      kind: "user",
      user: { id: "admin-1", portalRole: "admin", status: "active" },
    });

    await mountAuth();

    await waitForStatus(container, "authenticated");
    expect(fetchMeMock).toHaveBeenCalledTimes(1);
  });

  it("uses the user from dev-login and skips /me on the bootstrap dev-login path (auth.ci-session-restore-flake v5)", async () => {
    // dev-login's TokenResponse carries user in the same transaction as the
    // mint — no /me follow-up needed, no mint-then-read race.
    refreshMock.mockResolvedValue(false);
    devLoginMock.mockImplementation(async () => {
      setAccessToken("dev-token");
      return {
        access_token: "dev-token",
        token_type: "bearer",
        user: {
          id: "seed-org",
          portal_role: "org",
          status: "active",
        },
      };
    });
    window.history.pushState({}, "", "/org/browse");

    await mountAuth();

    await waitForStatus(container, "authenticated");
    expect(userText(container)).toBe("seed-org");
    expect(devLoginMock).toHaveBeenCalledTimes(1);
    expect(fetchMeMock).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe("dev-token");
  });

  it("falls back to /me when dev-login response lacks a user (older mock / schema drift)", async () => {
    refreshMock.mockResolvedValue(false);
    devLoginMock.mockImplementation(async () => {
      setAccessToken("dev-token");
      return { access_token: "dev-token" };
    });
    fetchMeMock.mockResolvedValue({
      kind: "user",
      user: {
        id: "seed-org",
        portalRole: "org",
        status: "active",
      },
    });
    window.history.pushState({}, "", "/org/browse");

    await mountAuth();

    await waitForStatus(container, "authenticated");
    expect(devLoginMock).toHaveBeenCalledTimes(1);
    expect(fetchMeMock).toHaveBeenCalledTimes(1);
  });

  it("retryRestore recovers to authenticated after a soft failure", async () => {
    let meCalls = 0;
    refreshMock.mockImplementation(async () => {
      setAccessToken("refreshed-token");
      return true;
    });
    fetchMeMock.mockImplementation(async () => {
      meCalls += 1;
      if (meCalls <= 2) return { kind: "error" as const };
      return {
        kind: "user" as const,
        user: {
          id: "recovered",
          portalRole: "admin" as const,
          status: "active",
        },
      };
    });

    await mountAuth();
    await waitForStatus(container, "restore_failed");

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-testid=retry]")!
        .click();
    });
    await waitForStatus(container, "authenticated");
    expect(userText(container)).toBe("recovered");
  });

  it("acceptSession wins over a late bootstrap failure", async () => {
    let finishRefresh!: (ok: boolean) => void;
    refreshMock.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    fetchMeMock.mockResolvedValue({ kind: "unauthenticated" });

    await mountAuth();

    expect(statusText(container)).toBe("authenticating");

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid=accept]")!.click();
    });
    expect(statusText(container)).toBe("authenticated");
    expect(userText(container)).toBe("login-user");
    expect(getAccessToken()).toBe("login-access-token");

    await act(async () => {
      finishRefresh(false);
    });
    await waitForStatus(container, "authenticated");
    expect(userText(container)).toBe("login-user");
    expect(getAccessToken()).toBe("login-access-token");
  });

  it("authenticates when refresh + /me succeed", async () => {
    refreshMock.mockResolvedValue(true);
    fetchMeMock.mockResolvedValue({
      kind: "user",
      user: {
        id: "cookie-user",
        portalRole: "admin",
        status: "active",
      },
    });

    await mountAuth();

    await waitForStatus(container, "authenticated");
    expect(userText(container)).toBe("cookie-user");
  });

  it("restoreAdminFromCookie superseded by acceptSession does not hang or clobber", async () => {
    refreshMock.mockResolvedValue(false);
    await mountAuth();
    await waitForStatus(container, "error");

    let finishRestore!: (ok: boolean) => void;
    refreshMock.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          finishRestore = resolve;
        }),
    );

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-testid=restore-admin]")!
        .click();
    });
    expect(statusText(container)).toBe("authenticating");

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid=accept]")!.click();
    });
    expect(statusText(container)).toBe("authenticated");

    await act(async () => {
      finishRestore(true);
    });
    await waitForStatus(container, "authenticated");
    expect(userText(container)).toBe("login-user");
  });

  it("restoreAdminFromCookie soft-fails when gen is stolen without a terminal status", async () => {
    refreshMock.mockResolvedValue(false);
    await mountAuth();
    await waitForStatus(container, "error");

    let finishRestore!: (ok: boolean) => void;
    refreshMock.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          finishRestore = resolve;
        }),
    );

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-testid=restore-admin]")!
        .click();
    });
    expect(statusText(container)).toBe("authenticating");

    // refreshUser bumps gen; on transient /me error it leaves status alone —
    // the hole that used to leave RequireAuth spinning on authenticating.
    fetchMeMock.mockResolvedValue({ kind: "error" });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-testid=refresh-user]")!
        .click();
    });

    await act(async () => {
      finishRestore(true);
    });
    await waitForStatus(container, "restore_failed");
  });

  it("remints View as from latch on portal path after admin cookie bootstrap", async () => {
    window.history.pushState({}, "", "/org/browse");
    setViewAsLatch("org-target", "org");
    refreshMock.mockImplementation(async () => {
      setAccessToken("admin-access");
      return true;
    });
    let meCalls = 0;
    fetchMeMock.mockImplementation(async () => {
      meCalls += 1;
      if (meCalls === 1) {
        return {
          kind: "user" as const,
          user: {
            id: "admin-1",
            portalRole: "admin" as const,
            status: "active",
          },
        };
      }
      return {
        kind: "user" as const,
        user: {
          id: "org-target",
          portalRole: "org" as const,
          status: "active",
          impersonatedBy: "admin-1",
        },
      };
    });
    resumeMock.mockResolvedValue(true);

    await mountAuth();

    await waitForStatus(container, "authenticated");
    expect(resumeMock).toHaveBeenCalledWith("org-target", expect.any(Number));
    expect(userText(container)).toBe("org-target");
    expect(peekViewAsLatch()?.userId).toBe("org-target");
  });

  it("remints View as from the intent cookie on /org/browse with no latch", async () => {
    window.history.pushState({}, "", "/org/browse");
    refreshMock.mockImplementation(async () => {
      setAccessToken("admin-access");
      return true;
    });
    fetchMeMock.mockResolvedValue({
      kind: "user",
      user: {
        id: "admin-1",
        portalRole: "admin",
        status: "active",
      },
    });
    resumeViewAsMock.mockResolvedValue("ok");
    takeImpersonatedUserMock.mockReturnValue({
      id: "org-target",
      portalRole: "org",
      status: "active",
      impersonatedBy: "admin-1",
    });

    await mountAuth();

    await waitForStatus(container, "authenticated");
    expect(resumeViewAsMock).toHaveBeenCalledWith("org");
    expect(resumeMock).not.toHaveBeenCalled();
    expect(userText(container)).toBe("org-target");
    expect(peekViewAsLatch()?.portalRole).toBe("org");
  });

  it("does not refresh latch setAt when cookie resume succeeds", async () => {
    window.history.pushState({}, "", "/org/browse");
    const setAt = Date.now() - 60 * 60 * 1000;
    sessionStorage.setItem(
      VIEW_AS_LATCH,
      JSON.stringify({ userId: "org-target", portalRole: "org", setAt }),
    );
    refreshMock.mockImplementation(async () => {
      setAccessToken("admin-access");
      return true;
    });
    fetchMeMock.mockResolvedValue({
      kind: "user",
      user: {
        id: "admin-1",
        portalRole: "admin",
        status: "active",
      },
    });
    resumeViewAsMock.mockResolvedValue("ok");
    takeImpersonatedUserMock.mockReturnValue({
      id: "org-target",
      portalRole: "org",
      status: "active",
      impersonatedBy: "admin-1",
    });

    await mountAuth();

    await waitForStatus(container, "authenticated");
    expect(peekViewAsLatch()?.setAt).toBe(setAt);
    expect(resumeMock).not.toHaveBeenCalled();
  });

  it("does not clear the view-as intent when refresh loses a rotation race", async () => {
    refreshMock.mockResolvedValue(false);
    devLoginMock.mockResolvedValue(null);

    await mountAuth();

    await waitForStatus(container, "error");
    expect(endViewAsMock).not.toHaveBeenCalled();
  });

  it("clears latch on /admin without reminting", async () => {
    window.history.pushState({}, "", "/admin");
    setViewAsLatch("org-target", "org");
    refreshMock.mockImplementation(async () => {
      setAccessToken("admin-access");
      return true;
    });
    fetchMeMock.mockResolvedValue({
      kind: "user",
      user: {
        id: "admin-1",
        portalRole: "admin",
        status: "active",
      },
    });

    await mountAuth();

    await waitForStatus(container, "authenticated");
    expect(resumeMock).not.toHaveBeenCalled();
    expect(endViewAsMock).toHaveBeenCalled();
    expect(userText(container)).toBe("admin-1");
    expect(peekViewAsLatch()).toBeNull();
  });

  it("clears latch and stays admin when remint fails", async () => {
    window.history.pushState({}, "", "/org/browse");
    setViewAsLatch("org-target", "org");
    refreshMock.mockImplementation(async () => {
      setAccessToken("admin-access");
      return true;
    });
    fetchMeMock.mockResolvedValue({
      kind: "user",
      user: {
        id: "admin-1",
        portalRole: "admin",
        status: "active",
      },
    });
    resumeMock.mockResolvedValue(false);

    await mountAuth();

    await waitForStatus(container, "authenticated");
    expect(resumeMock).toHaveBeenCalledTimes(1);
    expect(resumeMock).toHaveBeenCalledWith("org-target", expect.any(Number));
    expect(userText(container)).toBe("admin-1");
    expect(peekViewAsLatch()).toBeNull();
  });

  it("failHards on session-lost only after a settled authenticated session", async () => {
    refreshMock.mockImplementation(async () => {
      setAccessToken("refreshed-token");
      return true;
    });
    takeRefreshedUserMock.mockReturnValue({
      id: "admin-1",
      portalRole: "admin",
      status: "active",
    });

    await mountAuth();
    await waitForStatus(container, "authenticated");

    setAccessToken(null);
    act(() => {
      notifyApiSessionLost();
    });
    expect(statusText(container)).toBe("error");
    expect(getAccessToken()).toBeNull();
  });

  it("ignores session-lost while bootstrap is still authenticating", async () => {
    refreshMock.mockImplementation(() => new Promise(() => {}));

    await mountAuth();
    expect(statusText(container)).toBe("authenticating");

    act(() => {
      notifyApiSessionLost();
    });
    expect(statusText(container)).toBe("authenticating");
  });
});

function statusText(container: HTMLElement): string {
  return container.querySelector("[data-testid=status]")?.textContent ?? "";
}

function userText(container: HTMLElement): string {
  return container.querySelector("[data-testid=user]")?.textContent ?? "";
}

async function waitForStatus(
  container: HTMLElement,
  expected: string,
  attempts = 50,
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    if (statusText(container) === expected) return;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
  throw new Error(`expected status ${expected}, got ${statusText(container)}`);
}
