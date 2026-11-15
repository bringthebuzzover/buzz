/* eslint-disable testing-library/no-container -- The shared harness uses React DOM; Testing Library is not installed. */
import { act } from "react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../../testUtils";
import OrgProfilePage from "./OrgProfilePage";

const mockSubmit = jest.fn();
const mockRefresh = jest.fn();
const mockUser = {
  id: "org-1", portalRole: "org", status: "pending_org_profile",
  instagramUsername: "testorg",
};

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, refreshUser: mockRefresh }),
}));
jest.mock("../../api/hooks/useOnboardingHooks", () => ({
  useSubmitOnboarding: () => ({ mutateAsync: mockSubmit, isPending: false }),
  useAddressSuggest: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useAddressPreview: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

function fill(container: HTMLElement, selector: string, value: string) {
  const input = container.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
  expect(input).not.toBeNull();
  act(() => {
    const prototype = input.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  mockSubmit.mockReset();
  mockRefresh.mockReset().mockResolvedValue(null);
  mockUser.status = "pending_org_profile";
  sessionStorage.clear();
});

it.each([true, false])("submits the profile and carries email delivery state: %s", async (emailQueued) => {
  mockSubmit.mockResolvedValue({ emailQueued });
  const { container } = renderWithProviders(<Routes>
    <Route path="/onboarding/profile" element={<OrgProfilePage />} />
    <Route path="/onboarding/verify-email" element={<p>Verify school email</p>} />
  </Routes>, { route: "/onboarding/profile" });
  expect(container.textContent).toContain("Connected as @testorg");
  expect(container.textContent).not.toContain("Business Account");
  for (const [id, value] of [
    ["contact-name", "Test Officer"], ["edu-email", "org1@example.edu"],
    ["org-name", "Test Org"], ["university", "Test University"], ["member-count", "40"],
  ]) fill(container, `#org-onboarding-${id}`, value);
  fill(container, "select", "social");
  for (const [field, value] of [
    ["line1", "123 Test St"], ["city", "Test City"], ["state", "NY"], ["postal", "10001"],
  ]) fill(container, `[data-testid="org-onboarding-shipping-${field}"]`, value);
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
    orgName: "Test Org", eduEmail: "org1@example.edu", memberCount: 40,
    shippingLine1: "123 Test St", category: "social",
  }));
  expect(mockSubmit.mock.calls[0][0]).not.toHaveProperty("instagramHandle");
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem("buzz.verifyEmailSent")).toBe(emailQueued ? "1" : "0");
  expect(container.textContent).toBe("Verify school email");
});

it("redirects submitted profiles to their current onboarding step", () => {
  mockUser.status = "pending_approval";
  const { container } = renderWithProviders(<Routes>
    <Route path="/onboarding/profile" element={<OrgProfilePage />} />
    <Route path="/onboarding/pending-approval" element={<p>Awaiting approval</p>} />
  </Routes>, { route: "/onboarding/profile" });
  expect(container.textContent).toBe("Awaiting approval");
  expect(mockSubmit).not.toHaveBeenCalled();
});
