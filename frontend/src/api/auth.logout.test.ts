/**
 * logout(accessTokenOverride) must send that Bearer even when memory is cleared.
 */
import { logout, setAccessToken } from "./auth";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("logout Bearer override", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    setAccessToken(null);
  });

  it("sends Authorization from the override argument", async () => {
    setAccessToken(null);
    let authHeader: string | null = null;
    global.fetch = jest.fn(async (_url, init) => {
      const headers = new Headers(init?.headers);
      authHeader = headers.get("Authorization");
      return jsonResponse(200, { data: { ok: true } });
    }) as unknown as typeof fetch;

    await logout("override-access-token");
    expect(authHeader).toBe("Bearer override-access-token");
  });
});
