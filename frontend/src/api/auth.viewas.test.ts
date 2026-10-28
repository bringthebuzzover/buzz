/**
 * View-as sessionStorage latch + clearImpersonationSession hygiene.
 */
import {
  clearImpersonationSession,
  fetchMe,
  peekViewAsLatch,
  setAccessToken,
  setImpersonationToken,
  setViewAsLatch,
  VIEW_AS_LATCH,
  VIEW_AS_LATCH_TTL_MS,
  viewAsPortalRoleFromPath,
  isAdminPath,
  resumeImpersonation,
  resumeViewAs,
  getAccessToken,
  isImpersonating,
} from "./auth";

function jsonResponse(status: number, body: unknown): Response {
  const resp = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    clone() {
      return resp;
    },
  };
  return resp as unknown as Response;
}

describe("View-as latch", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    clearImpersonationSession();
  });

  afterEach(() => {
    global.fetch = realFetch;
    clearImpersonationSession();
  });

  it("does not refresh setAt when the same target is latched again", () => {
    const setAt = Date.now() - 5 * 60 * 1000;
    sessionStorage.setItem(
      VIEW_AS_LATCH,
      JSON.stringify({ userId: "target-1", portalRole: "org", setAt }),
    );
    setViewAsLatch("target-1", "org");
    expect(peekViewAsLatch()?.setAt).toBe(setAt);

    setViewAsLatch("target-2", "brand");
    const next = peekViewAsLatch();
    expect(next?.userId).toBe("target-2");
    expect(next?.setAt).not.toBe(setAt);
  });

  it("set/peek round-trips", () => {
    setViewAsLatch("target-1", "org");
    expect(peekViewAsLatch()).toEqual({
      userId: "target-1",
      portalRole: "org",
      setAt: expect.any(Number),
    });
  });

  it("clears corrupt payloads", () => {
    sessionStorage.setItem(VIEW_AS_LATCH, "{not-json");
    expect(peekViewAsLatch()).toBeNull();
    expect(sessionStorage.getItem(VIEW_AS_LATCH)).toBeNull();
  });

  it("clears expired latches", () => {
    sessionStorage.setItem(
      VIEW_AS_LATCH,
      JSON.stringify({
        userId: "old",
        portalRole: "brand",
        setAt: Date.now() - VIEW_AS_LATCH_TTL_MS - 1,
      }),
    );
    expect(peekViewAsLatch()).toBeNull();
  });

  it("clearImpersonationSession clears the latch", () => {
    setViewAsLatch("target-1", "org");
    setImpersonationToken("imp-token");
    clearImpersonationSession();
    expect(peekViewAsLatch()).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(isImpersonating()).toBe(false);
  });

  it("viewAsPortalRoleFromPath and isAdminPath", () => {
    expect(viewAsPortalRoleFromPath("/org/browse")).toBe("org");
    expect(viewAsPortalRoleFromPath("/org/campaigns/abc")).toBe("org");
    expect(viewAsPortalRoleFromPath("/campaigns")).toBe("org");
    expect(viewAsPortalRoleFromPath("/campaigns/abc")).toBe("org");
    expect(viewAsPortalRoleFromPath("/org/apply")).toBeNull();
    expect(viewAsPortalRoleFromPath("/brand/dashboard")).toBe("brand");
    expect(viewAsPortalRoleFromPath("/brand/setup")).toBe("brand");
    expect(viewAsPortalRoleFromPath("/brand/drops/abc")).toBe("brand");
    expect(viewAsPortalRoleFromPath("/brand/login")).toBeNull();
    expect(viewAsPortalRoleFromPath("/brand/apply")).toBeNull();
    expect(viewAsPortalRoleFromPath("/brand/forgot-password")).toBeNull();
    expect(viewAsPortalRoleFromPath("/brand/reset-password")).toBeNull();
    expect(viewAsPortalRoleFromPath("/admin")).toBeNull();
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/orgs")).toBe(true);
    expect(isAdminPath("/org/browse")).toBe(false);
  });

  it("resumeImpersonation installs impersonation token on 200", async () => {
    setAccessToken("admin-token");
    global.fetch = jest.fn(async () =>
      jsonResponse(200, { data: { accessToken: "imp-from-resume" } }),
    );
    await expect(resumeImpersonation("target-1")).resolves.toBe(true);
    expect(getAccessToken()).toBe("imp-from-resume");
    expect(isImpersonating()).toBe(true);
  });

  it("resumeImpersonation returns false on 403 without clearing latch", async () => {
    setAccessToken("admin-token");
    setViewAsLatch("target-1", "org");
    global.fetch = jest.fn(async () =>
      jsonResponse(403, { data: null, error: { code: "FORBIDDEN" } }),
    );
    await expect(resumeImpersonation("target-1")).resolves.toBe(false);
    expect(peekViewAsLatch()?.userId).toBe("target-1");
    expect(isImpersonating()).toBe(false);
    expect(
      (global.fetch as jest.Mock).mock.calls.every(
        (c) => !String(c[0]).includes("/api/auth/refresh"),
      ),
    ).toBe(true);
  });

  it("resumeImpersonation refreshes once on 401 then installs the token", async () => {
    setAccessToken("stale-admin");
    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/auth/refresh")) {
          return jsonResponse(200, {
            data: { access_token: "fresh-admin" },
          });
        }
        if (url.includes("/impersonate")) {
          const headers = new Headers(init?.headers);
          if (headers.get("Authorization") === "Bearer stale-admin") {
            return jsonResponse(401, {
              data: null,
              error: { code: "UNAUTHORIZED", message: "revoked" },
            });
          }
          return jsonResponse(200, {
            data: { accessToken: "imp-from-resume" },
          });
        }
        return jsonResponse(500, { data: null });
      },
    );
    await expect(resumeImpersonation("target-1")).resolves.toBe(true);
    expect(getAccessToken()).toBe("imp-from-resume");
    expect(isImpersonating()).toBe(true);
  });

  it("drops the bearer when the refresh retry fails", async () => {
    setAccessToken("admin-token");
    global.fetch = jest.fn(async () =>
      jsonResponse(401, { data: null, error: { code: "UNAUTHORIZED" } }),
    );
    await expect(resumeImpersonation("target-1")).resolves.toBe(false);
    expect(getAccessToken()).toBeNull();
    expect(isImpersonating()).toBe(false);
  });

  it("resumeViewAs installs from the cookie endpoint for the page role", async () => {
    setAccessToken("admin-token");
    global.fetch = jest.fn(async () =>
      jsonResponse(200, {
        data: {
          accessToken: "imp-from-cookie",
          user: {
            id: "target-1",
            portal_role: "org",
            status: "active",
            impersonated_by: "admin-1",
          },
        },
      }),
    );
    await expect(resumeViewAs("org")).resolves.toBe("ok");
    expect(getAccessToken()).toBe("imp-from-cookie");
    expect(isImpersonating()).toBe(true);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain("/api/admin/impersonate/resume");
    expect(JSON.parse(String(init.body))).toEqual({ role: "org" });
  });

  it("resumeViewAs does not install a target that does not match the page", async () => {
    setAccessToken("admin-token");
    global.fetch = jest.fn(async () =>
      jsonResponse(200, {
        data: {
          accessToken: "imp-brand",
          user: {
            id: "brand-1",
            portal_role: "brand",
            status: "active",
            impersonated_by: "admin-1",
          },
        },
      }),
    );
    await expect(resumeViewAs("org")).resolves.toBe("none");
    expect(getAccessToken()).toBe("admin-token");
    expect(isImpersonating()).toBe(false);
  });

  it("resumeViewAs treats a missing cookie as none and does not refresh", async () => {
    setAccessToken("admin-token");
    global.fetch = jest.fn(async () =>
      jsonResponse(404, { data: null, error: { code: "NOT_FOUND" } }),
    );
    await expect(resumeViewAs("org")).resolves.toBe("none");
    expect(getAccessToken()).toBe("admin-token");
    expect(
      (global.fetch as jest.Mock).mock.calls.every(
        (c) => !String(c[0]).includes("/api/auth/refresh"),
      ),
    ).toBe(true);
  });

  it("resumeViewAs does not refresh when the intent itself is invalid", async () => {
    setAccessToken("admin-token");
    global.fetch = jest.fn(async () =>
      jsonResponse(401, { data: null, error: { code: "VIEW_AS_INVALID" } }),
    );
    await expect(resumeViewAs("brand")).resolves.toBe("denied");
    expect(getAccessToken()).toBe("admin-token");
    expect(
      (global.fetch as jest.Mock).mock.calls.every(
        (c) => !String(c[0]).includes("/api/auth/refresh"),
      ),
    ).toBe(true);
  });
});

describe("fetchMe during View-as", () => {
  const realFetch = global.fetch;
  const originalLocation = window.location;

  afterEach(() => {
    global.fetch = realFetch;
    clearImpersonationSession();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("does not end View-as on UNAUTHORIZED", async () => {
    const hrefAssign = { href: "http://localhost/org/browse" };
    Object.defineProperty(window, "location", {
      configurable: true,
      value: hrefAssign,
    });
    setImpersonationToken("imp-stale");
    global.fetch = jest.fn(async () =>
      jsonResponse(401, {
        data: null,
        error: { code: "UNAUTHORIZED", message: "revoked" },
      }),
    );

    await expect(fetchMe()).resolves.toEqual({ kind: "error" });
    expect(isImpersonating()).toBe(true);
    expect(getAccessToken()).toBe("imp-stale");
    expect(hrefAssign.href).toBe("http://localhost/org/browse");
    expect(
      (global.fetch as jest.Mock).mock.calls.every(
        (c) => !String(c[0]).includes("/api/auth/refresh"),
      ),
    ).toBe(true);
  });

  it("ends View-as on TOKEN_EXPIRED", async () => {
    const order: string[] = [];
    const hrefAssign = {
      _href: "http://localhost/org/browse",
      get href() {
        return this._href;
      },
      set href(value: string) {
        order.push(`nav:${value}`);
        this._href = value;
      },
    };
    Object.defineProperty(window, "location", {
      configurable: true,
      value: hrefAssign,
    });
    setImpersonationToken("imp-expired");
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      order.push(String(input));
      return jsonResponse(401, {
        data: null,
        error: { code: "TOKEN_EXPIRED", message: "expired" },
      });
    });

    await expect(fetchMe()).resolves.toEqual({ kind: "unauthenticated" });
    expect(isImpersonating()).toBe(false);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(hrefAssign.href).toBe("/admin?impersonation=expired");
    const endAt = order.findIndex((entry) => entry.includes("/api/auth/view-as/end"));
    const navAt = order.indexOf("nav:/admin?impersonation=expired");
    expect(endAt).toBeGreaterThanOrEqual(0);
    expect(navAt).toBeGreaterThan(endAt);
  });
});
