/**
 * Awaiting-approval screen does not offer a school-email change.
 *
 * Uses react-dom (no @testing-library/react in this package).
 */
import { renderWithProviders } from "../../testUtils";

import PendingApprovalPage from "./PendingApprovalPage";

const mockRefreshUser = jest.fn(async () => null);

const mockAuthValue: {
  user: {
    id: string;
    portalRole: "org";
    status: string;
    email?: string;
    pendingEduEmail?: string;
    instagramConnectRequired?: boolean;
  };
  refreshUser: typeof mockRefreshUser;
} = {
  user: {
    id: "u-pa",
    portalRole: "org",
    status: "pending_approval",
    email: "club@test.edu",
  },
  refreshUser: mockRefreshUser,
};

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

describe("PendingApprovalPage", () => {
  beforeEach(() => {
    mockRefreshUser.mockReset();
    mockRefreshUser.mockResolvedValue(null);
    mockAuthValue.user = {
      id: "u-pa",
      portalRole: "org",
      status: "pending_approval",
      email: "club@test.edu",
    };
  });

  it("hides Change school email and shows the verified campus email", () => {
    const { container } = renderWithProviders(<PendingApprovalPage />, {
      route: "/onboarding/pending-approval",
    });

    expect(container.textContent).not.toContain("Change school email");
    expect(container.textContent).toContain(
      "Verified campus email: club@test.edu. We're reviewing your application.",
    );
    expect(container.textContent).toContain(
      "Your school email is locked while we review your application.",
    );
  });

  it("keeps the in-flight verification notice without a change control", () => {
    mockAuthValue.user = {
      ...mockAuthValue.user,
      pendingEduEmail: "next@test.edu",
    };
    const { container } = renderWithProviders(<PendingApprovalPage />, {
      route: "/onboarding/pending-approval",
    });

    expect(container.textContent).not.toContain("Change school email");
    expect(container.textContent).toContain(
      "Verification link sent to next@test.edu. Confirm your new school email.",
    );
  });

  it("tells a never-connected org its Connect step is what is left", () => {
    mockAuthValue.user = {
      ...mockAuthValue.user,
      instagramConnectRequired: true,
    };
    const { container } = renderWithProviders(<PendingApprovalPage />, {
      route: "/onboarding/pending-approval",
    });

    expect(container.textContent).toContain(
      "One step is left: connect your organization's Instagram.",
    );
    expect(container.textContent).not.toContain("We're reviewing your application.");
  });
});
