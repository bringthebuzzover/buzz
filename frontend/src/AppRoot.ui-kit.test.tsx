/**
 * /admin/ui-kit is registered in every build. Production used to omit it when
 * NODE_ENV was "production", so a signed-in admin hit the public 404. Jest
 * itself runs with NODE_ENV=test, which would also have hidden that gate.
 */
import { renderWithProviders } from "./testUtils";

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

function renderAt(path: string) {
  return renderWithProviders(<AppRoot />, { route: path });
}

describe("/admin/ui-kit", () => {
  it("renders inside the admin shell for a signed-in admin", () => {
    const mounted = renderAt("/admin/ui-kit");
    expect(mounted.container.querySelector("h1")?.textContent).toBe("UI kit");
    expect(mounted.container.textContent).toContain("Organizations");
    expect(mounted.container.querySelector("h1")?.textContent).not.toBe("404");
  });

  it("is not mounted on the old public path", () => {
    const mounted = renderAt("/dev/ui-kit");
    expect(mounted.container.textContent).not.toContain("Every shared primitive");
    expect(mounted.container.textContent).toContain("404");
  });
});
