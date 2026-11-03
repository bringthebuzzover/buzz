/**
 * PublicDropPage — restore_failed still shows the drop (acquisition URL).
 */
import { act } from "react";
import { renderWithProviders } from "../../testUtils";
import PublicDropPage from "./PublicDropPage";

const mockUseAuth = jest.fn();
const mockUseDropDetail = jest.fn();
const mockApply = jest.fn();

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

jest.mock("../../api/hooks/useDropHooks", () => ({
  useDropDetail: (...args: unknown[]) => mockUseDropDetail(...args),
  usePatchDropIntent: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useApplyToDrop: () => ({ mutateAsync: mockApply, isPending: false, error: null }),
}));

const now = Date.now();
const DROP_ID = "00000000-0000-0000-0000-000000000063";

function openDrop() {
  return {
    id: DROP_ID,
    brandName: "Acme",
    title: "Spring Drop",
    description: "Campaign copy",
    image: "https://cdn.example.test/hero.png",
    location: "Bay Area",
    capacityTotal: 8,
    acceptedCount: 0,
    applyOpenAt: now - 86_400_000,
    applyCloseAt: now + 7 * 86_400_000,
    stage: "applying",
  };
}

describe("PublicDropPage", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseDropDetail.mockReset();
    mockApply.mockReset().mockResolvedValue({ id: "application-1" });
  });

  it("still shows the drop when session restore failed", () => {
    mockUseAuth.mockReturnValue({
      status: "restore_failed",
      user: null,
      login: jest.fn(),
      retryRestore: jest.fn(),
      abandonRestore: jest.fn(),
    });
    mockUseDropDetail.mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      data: openDrop(),
    });

    container = renderWithProviders(<PublicDropPage />, {
      route: `/d/${DROP_ID}`,
      path: "/d/:dropId",
    }).container;

    expect(container.textContent).toContain("Spring Drop");
    expect(container.querySelector('[data-testid="session-restore-panel"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="auth-shell"]')).toBeNull();
    expect(container.textContent).not.toMatch(/Request to join Buzz and apply/);
  });

  it("uses the grey media well when the drop has no photo", () => {
    mockUseAuth.mockReturnValue({
      status: "restore_failed",
      user: null,
      login: jest.fn(),
      retryRestore: jest.fn(),
      abandonRestore: jest.fn(),
    });
    mockUseDropDetail.mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      data: { ...openDrop(), brandName: "Sample Brand", image: null },
    });

    container = renderWithProviders(<PublicDropPage />, {
      route: `/d/${DROP_ID}`,
      path: "/d/:dropId",
    }).container;

    expect(container.textContent).not.toContain("SB");
    expect(container.querySelector("[data-testid=image-fallback]")).toBeNull();
    expect(container.querySelector(".bg-buzz-greyMedia")).not.toBeNull();
  });

  it("links already-applied organizations to My Campaigns", () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { portalRole: "org", status: "active" },
      login: jest.fn(),
    });
    mockUseDropDetail.mockReturnValue({
      isLoading: false, isError: false, error: null,
      data: { ...openDrop(), alreadyApplied: true },
    });
    container = renderWithProviders(<PublicDropPage />, {
      route: `/d/${DROP_ID}`, path: "/d/:dropId",
    }).container;
    expect(container.textContent).toContain("Already applied");
    expect(container.querySelector('a[href="/org/campaigns"]')?.textContent).toContain("My Campaigns");
  });

  it("labels the optional pitch and confirms application with a My Campaigns link", async () => {
    mockUseAuth.mockReturnValue({
      status: "authenticated",
      user: { portalRole: "org", status: "active" },
      login: jest.fn(),
    });
    mockUseDropDetail.mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      data: openDrop(),
    });
    container = renderWithProviders(<PublicDropPage />, {
      route: `/d/${DROP_ID}`,
      path: "/d/:dropId",
    }).container;

    act(() => container.querySelector('[data-testid="apply-button"]')?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    ));
    expect(container.querySelector('label')?.textContent).toBe("Pitch (optional)");
    await act(async () => {
      container.querySelector('[data-testid="apply-submit"]')?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Application submitted");
    expect(container.querySelector('a[href="/org/campaigns"]')?.textContent).toContain("My Campaigns");
  });
});
