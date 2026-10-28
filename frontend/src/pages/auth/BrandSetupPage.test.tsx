/**
 * A real invite must survive an existing session. View-as, and a visit with
 * no token, still leave the form.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mockAuth: {
  status: string;
  user: null | {
    id: string;
    portalRole: string;
    status: string;
    impersonatedBy?: string;
  };
  acceptSession: () => void;
} = {
  status: "authenticated",
  user: null,
  acceptSession: () => {},
};

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

jest.mock("../../api/hooks/useOnboardingHooks", () => ({
  useBrandSetPassword: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

import BrandSetupPage from "./BrandSetupPage";

function renderAt(path: string): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/brand/setup" element={<BrandSetupPage />} />
          <Route path="/brand/dashboard" element={<p>brand dashboard</p>} />
          <Route path="/admin" element={<p>admin home</p>} />
          <Route path="/" element={<p>public home</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return { container, root };
}

describe("BrandSetupPage invite token", () => {
  let mounted: { container: HTMLDivElement; root: Root } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted?.root.unmount());
      mounted.container.remove();
      mounted = null;
    }
    mockAuth.status = "authenticated";
    mockAuth.user = null;
  });

  it("shows the form to a signed-in admin who opened an invite", () => {
    mockAuth.user = { id: "admin-1", portalRole: "admin", status: "active" };
    mounted = renderAt("/brand/setup?token=invite-token");
    expect(mounted.container.textContent).toContain("Activate account");
    expect(mounted.container.textContent).not.toContain("admin home");
  });

  it("shows the form to a signed-in org opening someone else's invite", () => {
    mockAuth.user = { id: "org-1", portalRole: "org", status: "active" };
    mounted = renderAt("/brand/setup?token=invite-token");
    expect(mounted.container.textContent).toContain("Activate account");
  });

  it("does not show the form during View as, even with a token", () => {
    mockAuth.user = {
      id: "brand-1",
      portalRole: "brand",
      status: "active",
      impersonatedBy: "admin-1",
    };
    mounted = renderAt("/brand/setup?token=invite-token");
    expect(mounted.container.textContent).toContain("brand dashboard");
    expect(mounted.container.textContent).not.toContain("Activate account");
  });

  it("sends View as with no token to the brand dashboard", () => {
    mockAuth.user = {
      id: "brand-1",
      portalRole: "brand",
      status: "active",
      impersonatedBy: "admin-1",
    };
    mounted = renderAt("/brand/setup");
    expect(mounted.container.textContent).toContain("brand dashboard");
    expect(mounted.container.textContent).not.toContain("Activate account");
  });
});
