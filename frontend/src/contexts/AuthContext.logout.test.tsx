/**
 * SPA logout must send Bearer before clearing memory so the API can bump
 * token_version (auth.spa-logout-drops-bearer).
 */
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { AuthProvider, useAuth } from "./AuthContext";

jest.mock("../api/auth", () => {
  const actual = jest.requireActual("../api/auth") as typeof import("../api/auth");
  return {
    ...actual,
    refreshAccessToken: jest.fn(async () => false),
    fetchMe: jest.fn(async () => ({ kind: "anonymous" as const })),
    logout: jest.fn(async () => {}),
    resumeImpersonation: jest.fn(),
  };
});

import { logout as apiLogout, setAccessToken } from "../api/auth";

const mockedLogout = apiLogout as jest.MockedFunction<typeof apiLogout>;

function Probe({ onReady }: { onReady: (logout: () => Promise<void>) => void }) {
  const { logout } = useAuth();
  onReady(logout);
  return null;
}

describe("AuthContext logout Bearer ordering", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hrefValue = "";

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockedLogout.mockClear();
    setAccessToken(null);
    hrefValue = "";
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        get href() {
          return hrefValue;
        },
        set href(v: string) {
          hrefValue = v;
        },
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    setAccessToken(null);
  });

  it("passes the access token to apiLogout before clearing memory", async () => {
    let logoutFn: (() => Promise<void>) | null = null;

    await act(async () => {
      root.render(
        <AuthProvider>
          <Probe
            onReady={(fn) => {
              logoutFn = fn;
            }}
          />
        </AuthProvider>,
      );
    });

    // Install after bootstrap so anonymous fetchMe cannot wipe it first.
    setAccessToken("access-before-logout");
    expect(logoutFn).not.toBeNull();
    await act(async () => {
      await logoutFn!();
    });

    expect(mockedLogout).toHaveBeenCalledWith("access-before-logout");
  });
});
