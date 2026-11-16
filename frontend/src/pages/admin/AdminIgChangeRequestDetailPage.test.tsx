/* eslint-disable testing-library/no-container -- The shared harness uses React DOM; Testing Library is not installed. */
import { act } from "react";
import { ApiError } from "../../api/errors";
import { renderWithProviders } from "../../testUtils";
import AdminIgChangeRequestDetailPage from "./AdminIgChangeRequestDetailPage";

const mockTicket = jest.fn();
const mockRetarget = jest.fn();
let mockPending = false;

jest.mock("../../api/hooks/useAdminHooks", () => ({
  useAdminIgChangeRequest: (...args: unknown[]) => mockTicket(...args),
  useApproveIgChangeRequest: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDenyIgChangeRequest: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRetargetIgChangeRequest: () => ({
    mutateAsync: (...args: unknown[]) => mockRetarget(...args),
    isPending: mockPending,
  }),
}));

const ticket = {
  id: "req-1",
  orgName: "Campus Club",
  userId: "user-1",
  currentHandle: "oldclub",
  requestedHandle: "newclub",
  kind: "account_switch",
  decidedKind: "account_switch",
  status: "awaiting_connect",
  reason: "We lost access to the old club account.",
  createdAt: 1700000000000,
};

beforeEach(() => {
  mockPending = false;
  mockRetarget.mockReset().mockResolvedValue({ ...ticket, requestedHandle: "realclub" });
  mockTicket.mockReturnValue({ data: { ...ticket }, isPending: false, isError: false });
});

function renderPage() {
  return renderWithProviders(<AdminIgChangeRequestDetailPage />, {
    route: "/admin/ig-changes/req-1",
    path: "/admin/ig-changes/:requestId",
  });
}

function handleInput(container: HTMLElement) {
  return container.querySelector('[data-testid="ig-change-retarget-handle"]') as HTMLInputElement;
}

function retargetButton(container: HTMLElement) {
  return container.querySelector('[data-testid="ig-change-retarget"]') as HTMLButtonElement;
}

function enterHandle(container: HTMLElement, value: string) {
  act(() => {
    const input = handleInput(container);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("lets an admin retarget an awaiting-connect ticket and shows the saved handle", async () => {
  const { container } = renderPage();
  expect(container.querySelector('[data-testid="ig-change-approve-switch"]')).toBeNull();
  expect(retargetButton(container).disabled).toBe(true);
  enterHandle(container, "  ");
  expect(retargetButton(container).disabled).toBe(true);
  enterHandle(container, "@realclub");
  expect(retargetButton(container).disabled).toBe(false);
  await act(async () => { retargetButton(container).click(); });
  expect(mockRetarget).toHaveBeenCalledWith({ requestId: "req-1", requestedHandle: "@realclub" });
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    "Reconnect target updated to @realclub.",
  );
  expect(handleInput(container).value).toBe("");
});

it.each([
  [new ApiError("VALIDATION_ERROR", "Enter a valid Instagram username.", 400),
    "Enter a valid Instagram username."],
  [new Error("failed"), "That action did not go through."],
])("shows an action error and allows retry", async (error, message) => {
  mockRetarget.mockRejectedValueOnce(error);
  const { container } = renderPage();
  enterHandle(container, "realclub");
  await act(async () => { retargetButton(container).click(); });
  expect(container.textContent).toContain(message);
  expect(handleInput(container).value).toBe("realclub");
  expect(retargetButton(container).disabled).toBe(false);
  await act(async () => { retargetButton(container).click(); });
  expect(container.textContent).not.toContain(message);
  expect(mockRetarget).toHaveBeenCalledTimes(2);
});

it("disables the handle and action while retargeting", () => {
  const view = renderPage();
  enterHandle(view.container, "realclub");
  mockPending = true;
  view.rerender(<AdminIgChangeRequestDetailPage />);
  expect(handleInput(view.container).disabled).toBe(true);
  expect(retargetButton(view.container).disabled).toBe(true);
  expect(retargetButton(view.container).textContent).toBe("Retargeting…");
  act(() => retargetButton(view.container).click());
  expect(mockRetarget).not.toHaveBeenCalled();
});

it.each(["pending", "approved", "denied"])("hides retarget for %s tickets", (status) => {
  mockTicket.mockReturnValue({ data: { ...ticket, status }, isPending: false, isError: false });
  const { container } = renderPage();
  expect(retargetButton(container)).toBeNull();
});
