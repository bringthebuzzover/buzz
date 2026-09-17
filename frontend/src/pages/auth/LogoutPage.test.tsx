/**
 * /logout waits for bootstrap, then uses the same sign-out path as the header.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

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
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockLogout.mockReset();
    mockLogout.mockResolvedValue(undefined);
    mockEndImpersonation.mockReset();
    mockEndImpersonation.mockResolvedValue(undefined);
    mockAuthValue.status = "authenticating";
    mockAuthValue.user = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("does not sign out while bootstrap is still running", () => {
    act(() => {
      root.render(<LogoutPage />);
    });
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockEndImpersonation).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Signing out/);
  });

  it("calls logout once bootstrap finishes as a signed-in user", () => {
    act(() => {
      root.render(<LogoutPage />);
    });
    mockAuthValue.status = "authenticated";
    mockAuthValue.user = {};
    act(() => {
      root.render(<LogoutPage />);
    });
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockEndImpersonation).not.toHaveBeenCalled();
  });

  it("exits View-as instead of posting logout", () => {
    mockAuthValue.status = "authenticated";
    mockAuthValue.user = { impersonatedBy: "admin-1" };
    act(() => {
      root.render(<LogoutPage />);
    });
    expect(mockEndImpersonation).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("still posts logout for a guest bootstrap (clears any leftover cookie)", () => {
    mockAuthValue.status = "error";
    mockAuthValue.user = null;
    act(() => {
      root.render(<LogoutPage />);
    });
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockEndImpersonation).not.toHaveBeenCalled();
  });
});
