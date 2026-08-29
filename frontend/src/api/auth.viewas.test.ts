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
  getAccessToken,
  isImpersonating,
} from "./auth";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
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
    expect(viewAsPortalRoleFromPath("/brand/dashboard")).toBe("brand");
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
    const hrefAssign = { href: "http://localhost/org/browse" };
    Object.defineProperty(window, "location", {
      configurable: true,
      value: hrefAssign,
    });
    setImpersonationToken("imp-expired");
    global.fetch = jest.fn(async () =>
      jsonResponse(401, {
        data: null,
        error: { code: "TOKEN_EXPIRED", message: "expired" },
      }),
    );

    await expect(fetchMe()).resolves.toEqual({ kind: "unauthenticated" });
    expect(isImpersonating()).toBe(false);
    expect(hrefAssign.href).toBe("/admin?impersonation=expired");
  });
});
