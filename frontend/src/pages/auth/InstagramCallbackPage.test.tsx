/**
 * Instagram OAuth callback error copy (no Graph / HTTP-status jargon).
 */
import { flushPromises, renderWithProviders } from "../../testUtils";
import InstagramCallbackPage from "./InstagramCallbackPage";
import { INSTAGRAM_CALLBACK_MISSING_PARAMS } from "../../utils/instagramCallbackCopy";

describe("InstagramCallbackPage", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("explains missing OAuth params without code/state jargon", () => {
    const { container } = renderWithProviders(<InstagramCallbackPage />, {
      route: "/auth/instagram/callback",
    });
    expect(container.textContent).toContain(INSTAGRAM_CALLBACK_MISSING_PARAMS);
    expect(container.textContent).toMatch(/Couldn't finish sign-in/);
    expect(container.textContent).not.toMatch(/Login failed/);
    expect(container.textContent).not.toMatch(/state parameter/i);
  });

  it("maps UNAUTHORIZED without status or code-exchange copy", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        data: null,
        error: {
          code: "UNAUTHORIZED",
          message: "Instagram code exchange failed.",
        },
      }),
    } as Response);

    const { container } = renderWithProviders(<InstagramCallbackPage />, {
      route: "/auth/instagram/callback?code=abc&state=xyz",
    });
    await flushPromises();

    expect(container.textContent).toMatch(/Instagram didn't connect/);
    expect(container.textContent).not.toMatch(/401/);
    expect(container.textContent).not.toMatch(/code exchange/i);
    expect(container.textContent).not.toMatch(/Login failed/);
  });
});
