import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import MetaReviewerPage from "./MetaReviewerPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("MetaReviewerPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.location.hash = "";
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    window.location.hash = "";
    jest.restoreAllMocks();
  });

  it("shows not-found and no reviewer chrome when the API says the path is off", async () => {
    window.location.hash = "#reviewer-test-secret";
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: "NOT_FOUND", message: "Not found." } }),
    } as Response);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/meta-review"]}>
          <MetaReviewerPage />
        </MemoryRouter>,
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain("This page does not exist");
    expect(container.textContent?.toLowerCase()).not.toContain("reviewer");
    expect(container.textContent).not.toContain("reviewer-test-secret");
    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(String(init.body)).toContain("reviewer-test-secret");
    expect(String(init.body)).not.toContain("next");
  });

  it("shows not-found without a request when the fragment is empty", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch");
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/meta-review"]}>
          <MetaReviewerPage />
        </MemoryRouter>,
      );
      await Promise.resolve();
    });
    expect(container.textContent).toContain("This page does not exist");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not echo a rejected secret", async () => {
    window.location.hash = "#reviewer-test-secret";
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: "UNAUTHORIZED", message: "Invalid reviewer link." } }),
    } as Response);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/meta-review"]}>
          <MetaReviewerPage />
        </MemoryRouter>,
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain("This reviewer link is not valid.");
    expect(container.textContent).not.toContain("reviewer-test-secret");
  });
});
