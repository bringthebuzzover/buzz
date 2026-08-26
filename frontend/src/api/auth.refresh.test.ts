/**
 * refreshAccessToken: a failed refresh must not clear a token installed by
 * login mid-flight; a successful refresh must always install the returned
 * access JWT (server rotated token_version). Callers must not join a stale
 * in-flight refresh after login, or start a second rotating refresh.
 */
import {
  devLogin,
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
} from "./auth";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("refreshAccessToken concurrent login", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    setAccessToken(null);
  });

  it("does not wipe a token set while a failed refresh was in flight", async () => {
    let finishRefresh!: (value: Response) => void;
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          finishRefresh = resolve;
        }),
    );

    const pending = refreshAccessToken();
    setAccessToken("login-token");
    finishRefresh(jsonResponse(401, { data: null, error: { code: "X" } }));

    await expect(pending).resolves.toBe(false);
    expect(getAccessToken()).toBe("login-token");
  });

  it("keeps the login token instead of joining or rotating after a stale refresh", async () => {
    let finishStale!: (value: Response) => void;
    let refreshCalls = 0;
    global.fetch = jest.fn(() => {
      refreshCalls += 1;
      if (refreshCalls === 1) {
        return new Promise<Response>((resolve) => {
          finishStale = resolve;
        });
      }
      return Promise.resolve(
        jsonResponse(200, { data: { access_token: "from-cookie" } }),
      );
    });

    // Bootstrap starts with no access token / no cookie.
    const stale = refreshAccessToken();
    // Login installs the access token (cookie is already in the browser).
    setAccessToken("login-token");

    // A later caller must not reuse the stale false, and must not rotate
    // token_version (which would invalidate login-token mid fetchMe).
    const afterLogin = refreshAccessToken();
    finishStale(jsonResponse(401, { data: null, error: { code: "X" } }));

    await expect(stale).resolves.toBe(false);
    await expect(afterLogin).resolves.toBe(true);
    expect(getAccessToken()).toBe("login-token");
    expect(refreshCalls).toBe(1);
  });

  it("installs the refresh access token when an in-flight refresh succeeds", async () => {
    let finishRefresh!: (value: Response) => void;
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          finishRefresh = resolve;
        }),
    );

    const pending = refreshAccessToken();
    setAccessToken("login-token");
    finishRefresh(
      jsonResponse(200, { data: { access_token: "from-refresh" } }),
    );

    await expect(pending).resolves.toBe(true);
    expect(getAccessToken()).toBe("from-refresh");
  });
});

describe("refreshAccessToken / devLogin throw retry (auth.ci-session-restore-flake)", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    setAccessToken(null);
  });

  it("retries refresh once when fetch throws, then succeeds", async () => {
    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { access_token: "after-retry" } }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(refreshAccessToken()).resolves.toBe(true);
    expect(getAccessToken()).toBe("after-retry");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry refresh on 401", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(401, { data: null, error: { code: "UNAUTHORIZED" } }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(refreshAccessToken()).resolves.toBe(false);
    expect(getAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns false when refresh throws twice", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError("network"));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(refreshAccessToken()).resolves.toBe(false);
    expect(getAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries devLogin once when fetch throws, then succeeds", async () => {
    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { access_token: "dev-after-retry" } }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await devLogin();
    expect(result?.access_token).toBe("dev-after-retry");
    expect(getAccessToken()).toBe("dev-after-retry");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry devLogin on 404", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(404, { data: null, error: { code: "NOT_FOUND" } }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(devLogin()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
