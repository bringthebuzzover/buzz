/* eslint-disable testing-library/no-container -- The shared harness uses React DOM; Testing Library is not installed. */
import { act } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders } from "../../testUtils";
import PendingApprovalPage from "./PendingApprovalPage";
import OrgProfilePage from "./OrgProfilePage";

const mockDraft: { data: unknown; isPending: boolean; isError: boolean; error?: Error } = { data: null, isPending: false, isError: false };
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
  useOrgApplyPrefill: () => mockDraft,
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
  Object.assign(mockDraft, { data: null, isPending: false, isError: false });
});

it.each([true, false])("submits the profile and carries email delivery state: %s", async (emailQueued) => {
  mockSubmit.mockRejectedValueOnce(new Error("Temporary failure")).mockResolvedValue({ emailQueued });
  const { container } = renderWithProviders(<Routes>
    <Route path="/onboarding/profile" element={<OrgProfilePage />} />
    <Route path="/onboarding/verify-email" element={<p>Verify school email</p>} />
  </Routes>, { route: "/onboarding/profile?prefill=draft-1&next=%2Fd%2F11111111-1111-1111-1111-111111111111" });
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
  const referral = container.querySelector<HTMLInputElement>('input[type="radio"][value="referral"]')!;
  act(() => referral.click());
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(container.textContent).toContain("Something went wrong. Please try again.");
  expect(mockRefresh).not.toHaveBeenCalled();
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
    prefillToken: "draft-1", orgName: "Test Org", eduEmail: "org1@example.edu", memberCount: 40,
    shippingLine1: "123 Test St", category: "social", howFound: "referral",
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

it("hydrates the invitation draft without replacing the OAuth identity", () => {
  mockDraft.data = { orgName: "Invited Org", eduEmail: "org1@example.edu", memberCount: 0,
    contactName: "Test Officer", shippingLine1: "123 Test St", instagramHandle: "different_org" };
  const { container } = renderWithProviders(<OrgProfilePage />, { route: "/onboarding/profile?prefill=draft-1" });
  expect((container.querySelector("#org-onboarding-org-name") as HTMLInputElement).value).toBe("Invited Org");
  expect((container.querySelector("#org-onboarding-member-count") as HTMLInputElement).value).toBe("0");
  expect(container.textContent).toContain("Connected as @testorg");
  expect(container.textContent).not.toContain("different_org");
});

it.each(["loading", "error"])("blocks submission while the invitation is %s", (state) => {
  mockDraft.isPending = state === "loading";
  mockDraft.isError = state === "error";
  const { container } = renderWithProviders(<OrgProfilePage />, { route: "/onboarding/profile?prefill=draft-1" });
  const blocked = state === "loading" ? container.querySelector("form") === null
    : (container.querySelector("button[type=submit]") as HTMLButtonElement).disabled;
  expect(blocked).toBe(true);
  expect(mockSubmit).not.toHaveBeenCalled();
});

it("keeps the drop destination through approval and returns there once active", () => {
  mockUser.status = "pending_approval";
  function Destination() {
    return <p>{useLocation().pathname}</p>;
  }
  const routes = () => <Routes>
    <Route path="/onboarding/pending-approval" element={<PendingApprovalPage />} />
    <Route path="/d/:id" element={<Destination />} />
  </Routes>;
  const { container, rerender } = renderWithProviders(routes(), {
    route: "/onboarding/pending-approval?next=%2Fd%2F11111111-1111-1111-1111-111111111111",
  });
  expect(container.textContent).toContain("Application Received");
  mockUser.status = "active";
  rerender(routes());
  expect(container.textContent).toBe("/d/11111111-1111-1111-1111-111111111111");
});
