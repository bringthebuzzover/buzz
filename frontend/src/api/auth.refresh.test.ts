/**
 * refreshAccessToken must not clear a token installed by login while the
 * refresh request was still in flight.
 */
import {
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
});
