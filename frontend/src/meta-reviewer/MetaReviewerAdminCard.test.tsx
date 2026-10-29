/**
 * META-REVIEWER-PATH: the admin card stays off the page when status is 404,
 * and a successful seed never paints the link secret.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MetaReviewerAdminCard from "./MetaReviewerAdminCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DROP_ID = "647ea986-5af0-44c8-b5ff-03cbddf2d2fd";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const ORG_ID = "22222222-2222-2222-2222-222222222222";
const SECRET = "link-secret-must-not-render";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("MetaReviewerAdminCard", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.restoreAllMocks();
  });

  async function settle() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }

  async function renderCard() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <MetaReviewerAdminCard />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
    await settle();
    await settle();
  }

  it("renders nothing when the status route is off", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(404, {
        data: null,
        error: { code: "NOT_FOUND", message: "Not found." },
      }),
    );

    await renderCard();

    expect(container.textContent).not.toContain("Meta App Review");
    expect(container.querySelector("[data-testid=meta-reviewer-admin]")).toBeNull();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/meta-reviewer/status");
    expect(container.textContent).not.toContain(SECRET);
  });

  it("seeds through the API client and does not show the link secret", async () => {
    let seeded = false;
    const fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/meta-reviewer/status")) {
        return jsonResponse(200, {
          data: {
            enabled: true,
            seeded,
            orgId: seeded ? ORG_ID : null,
            userId: seeded ? USER_ID : null,
            dropId: DROP_ID,
            linkSecret: SECRET,
          },
          error: null,
        });
      }
      if (url.includes("/api/meta-reviewer/seed")) {
        expect(init?.method).toBe("POST");
        expect(init?.body ?? "").not.toContain(SECRET);
        seeded = true;
        return jsonResponse(200, {
          data: {
            userId: USER_ID,
            orgId: ORG_ID,
            dropId: DROP_ID,
            applicationId: "33333333-3333-3333-3333-333333333333",
            createdUser: true,
            createdApplication: true,
            linkSecret: SECRET,
          },
          error: null,
        });
      }
      throw new Error(`unexpected ${url}`);
    });

    await renderCard();

    expect(container.textContent).toContain("Not set up");
    expect(container.textContent).not.toContain(DROP_ID);
    const dropLink = container.querySelector("[data-testid=meta-reviewer-drop]");
    expect(dropLink?.getAttribute("href")).toBe(`/admin/drops/${DROP_ID}`);
    expect(dropLink?.textContent).toContain("Open drop");
    expect(container.textContent).not.toContain(SECRET);

    const button = container.querySelector("[data-testid=meta-reviewer-seed]");
    expect(button).not.toBeNull();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle();
    await settle();

    expect(container.textContent).toContain("Reviewer organization created.");
    expect(container.textContent).toContain("Reviewer organization ready");
    const orgLink = container.querySelector("[data-testid=meta-reviewer-org]");
    expect(orgLink?.getAttribute("href")).toBe(`/admin/orgs/${USER_ID}`);
    expect(container.textContent).not.toContain(SECRET);
    expect(container.innerHTML).not.toContain(SECRET);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/meta-reviewer/seed"))).toBe(
      true,
    );
  });
});
