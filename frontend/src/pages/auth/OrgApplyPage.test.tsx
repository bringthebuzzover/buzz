/* eslint-disable testing-library/no-container -- The shared harness uses React DOM; Testing Library is not installed. */
/**
 * /org/apply — Instagram-first connect screen and personal-account error state.
 *
 * Uses react-dom (no @testing-library/react in this package).
 */
import { act } from "react";
import { renderWithProviders } from "../../testUtils";
import OrgApplyPage from "./OrgApplyPage";

const mockLogin = jest.fn();

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    status: "error",
    user: null,
    login: mockLogin,
  }),
}));

describe("OrgApplyPage Instagram-first onboarding", () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  it("renders the Instagram-first connect state and starts OAuth on click", () => {
    const { container } = renderWithProviders(<OrgApplyPage />, {
      route: "/org/apply",
    });

    expect(container.textContent).toContain(
      "Join as a student organization and work with brands on real campus campaigns.",
    );
    expect(container.textContent).toContain("Apply as a");
    expect(container.textContent).toContain("Student Organization");
    expect(container.textContent).toContain(
      "Connect your organization's Instagram to get started. BUZZ verifies your handle and audience metrics directly with Meta.",
    );

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toBe("Continue with Instagram");

    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => ({
      text: a.textContent,
      href: a.getAttribute("href"),
    }));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        { text: "Log in with Instagram", href: "/login" },
        { text: "See how it works", href: "/for-orgs" },
        { text: "Brand login", href: "/brand/login" },
      ]),
    );

    act(() => {
      button.click();
    });

    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe("Connecting…");
  });

  it("renders the personal account error state when ?error=personal_account is set", () => {
    const { container } = renderWithProviders(<OrgApplyPage />, {
      route: "/org/apply?error=personal_account",
    });

    expect(container.textContent).toContain("Professional Account Required");
    expect(container.textContent).toContain("Account Type Error");
    expect(container.textContent).toContain(
      "Your Instagram account is set to Personal. Switch to a free Business or Creator account in Instagram Settings, then retry below.",
    );

    const kicker = Array.from(container.querySelectorAll("p")).find((el) =>
      el.textContent?.includes("Professional Account Required"),
    );
    expect(kicker?.className).toContain("text-red-400");

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toBe("Try Again with Instagram");

    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => ({
      text: a.textContent,
      href: a.getAttribute("href"),
    }));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        { text: "View Instagram guide", href: "/for-orgs#instagram-guide" },
        { text: "See how it works", href: "/for-orgs" },
        { text: "Brand login", href: "/brand/login" },
      ]),
    );

    act(() => {
      button.click();
    });

    expect(mockLogin).toHaveBeenCalledTimes(1);
  });
});
