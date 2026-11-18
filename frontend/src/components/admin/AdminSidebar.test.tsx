import { showAdminUiKitNav } from "./AdminSidebar";

describe("showAdminUiKitNav", () => {
  it("shows the link in development and when the app env is staging", () => {
    expect(showAdminUiKitNav("development", undefined)).toBe(true);
    expect(showAdminUiKitNav("production", "staging")).toBe(true);
    expect(showAdminUiKitNav("test", "staging")).toBe(true);
  });

  it("hides the link outside development when the app env is not staging", () => {
    expect(showAdminUiKitNav("production", undefined)).toBe(false);
    expect(showAdminUiKitNav("production", "production")).toBe(false);
    expect(showAdminUiKitNav("test", undefined)).toBe(false);
  });
});
