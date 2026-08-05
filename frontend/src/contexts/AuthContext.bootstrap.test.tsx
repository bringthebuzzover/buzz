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
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
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
  };
});

import {
  fetchMe,
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
} from "../api/auth";

const refreshMock = refreshAccessToken as jest.MockedFunction<
  typeof refreshAccessToken
>;
const fetchMeMock = fetchMe as jest.MockedFunction<typeof fetchMe>;
const devLoginMock = jest.requireMock("../api/auth").devLogin as jest.Mock;

function Probe() {
  const { status, user, acceptSession } = useAuth();
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
    </div>
  );
}

describe("AuthProvider bootstrap resolution", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    refreshMock.mockReset();
    fetchMeMock.mockReset();
    devLoginMock.mockReset();
    setAccessToken(null);
    window.history.pushState({}, "", "/admin");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    setAccessToken(null);
  });

  it("ends in error (not hung authenticating) when refresh ok but /me never yields a user", async () => {
    refreshMock.mockResolvedValue(true);
    fetchMeMock.mockResolvedValue({ kind: "error" });

    await act(async () => {
      root.render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

    await waitForStatus(container, "error");
    expect(getAccessToken()).toBeNull();
    expect(fetchMeMock).toHaveBeenCalledTimes(2);
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

    await act(async () => {
      root.render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

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

    await act(async () => {
      root.render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

    await waitForStatus(container, "authenticated");
    expect(userText(container)).toBe("cookie-user");
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
