/**
 * /logout waits for bootstrap, then uses the same sign-out path as the header.
 */
import { renderWithProviders } from "../../testUtils";

const mockLogout = jest.fn(async () => {});
const mockEndImpersonation = jest.fn(async () => {});

const mockAuthValue: {
  status: string;
  user: null | { impersonatedBy?: string };
  logout: typeof mockLogout;
} = {
  status: "authenticating",
  user: null,
  logout: mockLogout,
};

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock("../../api/hooks/useEndImpersonation", () => ({
  useEndImpersonation: () => mockEndImpersonation,
}));

import LogoutPage from "./LogoutPage";

describe("LogoutPage", () => {
  beforeEach(() => {
    mockLogout.mockReset();
    mockLogout.mockResolvedValue(undefined);
    mockEndImpersonation.mockReset();
    mockEndImpersonation.mockResolvedValue(undefined);
    mockAuthValue.status = "authenticating";
    mockAuthValue.user = null;
  });

  it("does not sign out while bootstrap is still running", () => {
    const { container } = renderWithProviders(<LogoutPage />);
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockEndImpersonation).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Signing out/);
  });

  it("calls logout once bootstrap finishes as a signed-in user", () => {
    const view = renderWithProviders(<LogoutPage />);
    mockAuthValue.status = "authenticated";
    mockAuthValue.user = {};
    view.rerender(<LogoutPage />);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockEndImpersonation).not.toHaveBeenCalled();
  });

  it("exits View-as instead of posting logout", () => {
    mockAuthValue.status = "authenticated";
    mockAuthValue.user = { impersonatedBy: "admin-1" };
    renderWithProviders(<LogoutPage />);
    expect(mockEndImpersonation).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("still posts logout for a guest bootstrap (clears any leftover cookie)", () => {
    mockAuthValue.status = "error";
    mockAuthValue.user = null;
    renderWithProviders(<LogoutPage />);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockEndImpersonation).not.toHaveBeenCalled();
  });
});
