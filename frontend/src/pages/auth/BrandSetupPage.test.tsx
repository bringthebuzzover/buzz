/**
 * A real invite must survive an existing session. View-as, and a visit with
 * no token, still leave the form.
 */
import { renderWithProviders } from "../../testUtils";
import { Route, Routes } from "react-router-dom";

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

function renderAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/brand/setup" element={<BrandSetupPage />} />
      <Route path="/brand/dashboard" element={<p>brand dashboard</p>} />
      <Route path="/admin" element={<p>admin home</p>} />
      <Route path="/" element={<p>public home</p>} />
    </Routes>,
    { route: path },
  );
}

describe("BrandSetupPage invite token", () => {
  afterEach(() => {
    mockAuth.status = "authenticated";
    mockAuth.user = null;
  });

  it("shows the form to a signed-in admin who opened an invite", () => {
    mockAuth.user = { id: "admin-1", portalRole: "admin", status: "active" };
    const mounted = renderAt("/brand/setup?token=invite-token");
    expect(mounted.container.textContent).toContain("Activate account");
    expect(mounted.container.textContent).not.toContain("admin home");
  });

  it("shows the form to a signed-in org opening someone else's invite", () => {
    mockAuth.user = { id: "org-1", portalRole: "org", status: "active" };
    const mounted = renderAt("/brand/setup?token=invite-token");
    expect(mounted.container.textContent).toContain("Activate account");
  });

  it("does not show the form during View as, even with a token", () => {
    mockAuth.user = {
      id: "brand-1",
      portalRole: "brand",
      status: "active",
      impersonatedBy: "admin-1",
    };
    const mounted = renderAt("/brand/setup?token=invite-token");
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
    const mounted = renderAt("/brand/setup");
    expect(mounted.container.textContent).toContain("brand dashboard");
    expect(mounted.container.textContent).not.toContain("Activate account");
  });
});
