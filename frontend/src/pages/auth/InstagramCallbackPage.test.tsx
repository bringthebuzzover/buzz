/**
 * Instagram OAuth callback error copy (no Graph / HTTP-status jargon).
 */
import { flushPromises, renderWithProviders } from "../../testUtils";
import { setAccessToken } from "../../api/auth";
import InstagramCallbackPage from "./InstagramCallbackPage";
import { INSTAGRAM_CALLBACK_MISSING_PARAMS } from "../../utils/instagramCallbackCopy";

describe("InstagramCallbackPage", () => {
  const originalLocation = window.location;
  beforeAll(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });
  });

  beforeEach(() => {
    window.location.href = "";
  });

  afterAll(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  afterEach(() => {
    setAccessToken(null);
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

  it.each([
    ["pending_org_profile", "/onboarding/profile?next=%2Fd%2F11111111-1111-1111-1111-111111111111&prefill=draft-1"],
    ["pending_email_verification", "/onboarding/verify-email?next=%2Fd%2F11111111-1111-1111-1111-111111111111"],
    ["pending_approval", "/onboarding/pending-approval?next=%2Fd%2F11111111-1111-1111-1111-111111111111"],
    ["active", "/d/11111111-1111-1111-1111-111111111111"],
  ])("lands %s users at %s", async (status, destination) => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: {
        access_token: "fake-session",
        user: { id: "org-1", portal_role: "org", status },
        next: "/d/11111111-1111-1111-1111-111111111111",
        prefill: "draft-1",
      } }),
    } as Response);
    renderWithProviders(<InstagramCallbackPage />, {
      route: "/auth/instagram/callback?code=abc&state=xyz",
    });
    await flushPromises();
    expect(window.location.href).toBe(destination);
  });

  it("returns Personal accounts to the signup recovery state", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: "INSTAGRAM_PERSONAL_ACCOUNT" } }),
    } as Response);
    renderWithProviders(<InstagramCallbackPage />, {
      route: "/auth/instagram/callback?code=abc&state=xyz",
    });
    await flushPromises();
    expect(window.location.href).toBe("/org/apply?error=personal_account");
  });

  it("shows recovery instead of navigating when the session is incomplete", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response);
    const { container } = renderWithProviders(<InstagramCallbackPage />, {
      route: "/auth/instagram/callback?code=abc&state=xyz",
    });
    await flushPromises();
    expect(window.location.href).toBe("");
    expect(container.textContent).toContain(INSTAGRAM_CALLBACK_MISSING_PARAMS);
  });

});
