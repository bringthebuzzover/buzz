/**
 * Instagram OAuth callback error copy (no Graph / HTTP-status jargon).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import InstagramCallbackPage from "./InstagramCallbackPage";
import { INSTAGRAM_CALLBACK_MISSING_PARAMS } from "../../utils/instagramCallbackCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("InstagramCallbackPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.restoreAllMocks();
  });

  it("explains missing OAuth params without code/state jargon", () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/auth/instagram/callback"]}>
          <InstagramCallbackPage />
        </MemoryRouter>,
      );
    });
    expect(container.textContent).toContain(INSTAGRAM_CALLBACK_MISSING_PARAMS);
    expect(container.textContent).toMatch(/Login failed/);
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

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/auth/instagram/callback?code=abc&state=xyz"]}
        >
          <InstagramCallbackPage />
        </MemoryRouter>,
      );
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/didn't complete/i);
    expect(container.textContent).not.toMatch(/401/);
    expect(container.textContent).not.toMatch(/code exchange/i);
  });
});
