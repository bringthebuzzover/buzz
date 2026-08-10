/**
 * Unit tests for the API client plumbing (envelope unwrap, auth header, and the
 * 401 -> refresh -> replay interceptor). DOM-free; runs under `craco test`.
 */
import { apiFetch, ApiError } from "./client";
import { setAccessToken } from "./auth";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("apiFetch", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    setAccessToken(null);
    jest.clearAllMocks();
  });

  it("unwraps the envelope data on success", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { data: { x: 1 }, meta: null, error: null }),
      );
    const res = await apiFetch<{ x: number }>("/api/x");
    expect(res.data).toEqual({ x: 1 });
  });

  it("throws ApiError carrying the envelope code", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(403, {
        data: null,
        meta: null,
        error: { code: "FORBIDDEN", message: "nope" },
      }),
    );
    await expect(apiFetch("/api/x")).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("attaches the Authorization header when a token is set", async () => {
    setAccessToken("tok123");
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { data: {}, meta: null, error: null }),
      );
    global.fetch = fetchMock;

    await apiFetch("/api/x");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer tok123");
  });

  it("refreshes once and replays on TOKEN_EXPIRED", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, {
          data: null,
          meta: null,
          error: { code: "TOKEN_EXPIRED", message: "expired" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { access_token: "fresh" },
          meta: null,
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { ok: true }, meta: null, error: null }),
      );
    global.fetch = fetchMock;

    const res = await apiFetch<{ ok: boolean }>("/api/x");
    expect(res.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry more than once on repeated 401s", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, {
          data: null,
          meta: null,
          error: { code: "TOKEN_EXPIRED", message: "expired" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { access_token: "fresh" },
          meta: null,
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(401, {
          data: null,
          meta: null,
          error: { code: "TOKEN_EXPIRED", message: "expired again" },
        }),
      );
    global.fetch = fetchMock;

    await expect(apiFetch("/api/x")).rejects.toMatchObject({
      code: "TOKEN_EXPIRED",
    });
    // initial + refresh + single replay = 3 (no infinite loop)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
