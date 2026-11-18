import { act } from "react";
import { renderWithProviders } from "../../testUtils";
import HomePage from "./HomePage";

const mockOpenAuthModal = jest.fn();

jest.mock("../../contexts/SiteChromeContext", () => ({
  useSiteChrome: () => ({
    openContactModal: jest.fn(),
    openAuthModal: mockOpenAuthModal,
  }),
}));

describe("HomePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("triggers openAuthModal with signup mode when hero Join button is clicked", () => {
    const { container } = renderWithProviders(<HomePage />, { route: "/" });

    const joinButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((btn) => btn.textContent?.trim() === "Join");

    expect(joinButton).toBeDefined();

    act(() => {
      joinButton?.click();
    });

    expect(mockOpenAuthModal).toHaveBeenCalledWith("signup");
  });
});
