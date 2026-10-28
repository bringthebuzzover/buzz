/**
 * /admin/ui-kit is registered in every build. Production used to omit it when
 * NODE_ENV was "production", so a signed-in admin hit the public 404. Jest
 * itself runs with NODE_ENV=test, which would also have hidden that gate.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

jest.mock("./contexts/AuthContext", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: {
      id: "admin-1",
      portalRole: "admin",
      status: "active",
    },
    logout: jest.fn(),
  }),
}));

import AppRoot from "./AppRoot";

function renderAt(path: string): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoot />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  return { container, root };
}

describe("/admin/ui-kit", () => {
  let mounted: { container: HTMLDivElement; root: Root } | null = null;

  afterEach(() => {
    if (!mounted) return;
    const { container, root } = mounted;
    act(() => {
      root.unmount();
    });
    container.remove();
    mounted = null;
  });

  it("renders inside the admin shell for a signed-in admin", () => {
    mounted = renderAt("/admin/ui-kit");
    expect(mounted.container.querySelector("h1")?.textContent).toBe("UI kit");
    expect(mounted.container.textContent).toContain("Organizations");
    expect(mounted.container.querySelector("h1")?.textContent).not.toBe("404");
  });

  it("is not mounted on the old public path", () => {
    mounted = renderAt("/dev/ui-kit");
    expect(mounted.container.textContent).not.toContain("Every shared primitive");
    expect(mounted.container.textContent).toContain("404");
  });
});
