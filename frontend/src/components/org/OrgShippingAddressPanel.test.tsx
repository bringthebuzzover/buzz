import { act } from "react";
import { renderWithProviders } from "../../testUtils";
import OrgShippingAddressPanel from "./OrgShippingAddressPanel";
import { EMPTY_SHIPPING } from "./ShippingAddressFields";

const mockRequestState = jest.fn();

jest.mock("../../api/hooks/useOrgHooks", () => ({
  useOrgShippingChangeRequestState: () => mockRequestState(),
  useSubmitOrgShippingChangeRequest: () => ({ isPending: false }),
}));

beforeEach(() => {
  mockRequestState.mockReturnValue({ data: {}, isPending: false });
});

it("opens an address request without submitting the surrounding profile form", () => {
  const onSubmit = jest.fn((event) => event.preventDefault());
  renderWithProviders(
    <form onSubmit={onSubmit}>
      <OrgShippingAddressPanel
        currentAddress={{ line1: "1 Test St", line2: null, city: "Test City", state: "NY", postalCode: "10001", formatted: null }}
        initialAddress={false}
        onInitialAddressChange={jest.fn()}
        initialValue={EMPTY_SHIPPING}
      />
    </form>,
  );
  const request = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === "Request address change",
  );
  expect(request?.type).toBe("button");
  act(() => request?.click());
  expect(document.body.textContent).toContain("Request shipping address change");
  expect(onSubmit).not.toHaveBeenCalled();
});

it("notifies the organization that its latest address request was denied", () => {
  mockRequestState.mockReturnValue({
    data: { latest: { status: "denied", decisionReason: "Confirm the new destination." } },
    isPending: false,
  });
  const { container } = renderWithProviders(
    <OrgShippingAddressPanel
      currentAddress={{ line1: "1 Test St", line2: null, city: "Test City", state: "NY", postalCode: "10001", formatted: null }}
      initialAddress={false}
      onInitialAddressChange={jest.fn()}
      initialValue={EMPTY_SHIPPING}
    />,
  );
  expect(container.textContent).toContain("The latest address request was denied: Confirm the new destination.");
});
