/**
 * Instagram reconnect paths: fetchMe distinguishes INSTAGRAM_TOKEN_EXPIRED;
 * apiFetch hard-navs mid-session.
 */
import {
  clearInstagramReconnectLatch,
  fetchMe,
  getAccessToken,
  hasInstagramReconnectLatch,
  INSTAGRAM_RECONNECT_LATCH,
  setAccessToken,
} from "./auth";
import { apiFetch } from "./client";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("Instagram reconnect auth helpers", () => {
  const realFetch = global.fetch;
  const originalLocation = window.location;

  beforeEach(() => {
    setAccessToken("access");
    clearInstagramReconnectLatch();
  });

  afterEach(() => {
    global.fetch = realFetch;
    setAccessToken(null);
    clearInstagramReconnectLatch();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("fetchMe returns instagram_reconnect and sets latch on IG expiry", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(401, {
        data: null,
        error: { code: "INSTAGRAM_TOKEN_EXPIRED", message: "expired" },
      }),
    );

    const result = await fetchMe();
    expect(result).toEqual({ kind: "instagram_reconnect" });
    expect(hasInstagramReconnectLatch()).toBe(true);
    expect(sessionStorage.getItem(INSTAGRAM_RECONNECT_LATCH)).toBe("1");
    // Must not attempt Buzz refresh for IG expiry.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("fetchMe still refreshes on Buzz TOKEN_EXPIRED", async () => {
    let calls = 0;
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls += 1;
      if (url.includes("/api/auth/me") && calls === 1) {
        return jsonResponse(401, {
          data: null,
          error: { code: "TOKEN_EXPIRED", message: "jwt" },
        });
      }
      if (url.includes("/api/auth/refresh")) {
        return jsonResponse(200, { data: { access_token: "new-access" } });
      }
      return jsonResponse(200, {
        data: {
          id: "u1",
          portal_role: "org",
          status: "active",
          instagram_username: "club",
        },
      });
    });

    const result = await fetchMe();
    expect(result.kind).toBe("user");
    expect(getAccessToken()).toBe("new-access");
    expect(hasInstagramReconnectLatch()).toBe(false);
  });

  it("apiFetch hard-navigates on INSTAGRAM_TOKEN_EXPIRED without refresh", async () => {
    const hrefAssign = { href: "http://localhost/" };
    Object.defineProperty(window, "location", {
      configurable: true,
      value: hrefAssign,
    });

    global.fetch = jest.fn(async () =>
      jsonResponse(401, {
        data: null,
        error: { code: "INSTAGRAM_TOKEN_EXPIRED", message: "expired" },
      }),
    );

    await expect(apiFetch("/api/orgs/me")).rejects.toMatchObject({
      code: "INSTAGRAM_TOKEN_EXPIRED",
    });
    expect(hasInstagramReconnectLatch()).toBe(true);
    expect(getAccessToken()).toBeNull();
    expect(hrefAssign.href).toBe("/reconnect-instagram");
    expect(String(global.fetch)).not.toContain("refresh");
    expect(
      (global.fetch as jest.Mock).mock.calls.every(
        (c) => !String(c[0]).includes("/api/auth/refresh"),
      ),
    ).toBe(true);
  });
});
