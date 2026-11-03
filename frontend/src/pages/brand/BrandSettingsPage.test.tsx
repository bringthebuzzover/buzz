import { act } from "react";
import { ApiError } from "../../api/errors";
import { renderWithProviders } from "../../testUtils";

import BrandSettingsPage from "./BrandSettingsPage";

const mockUpdate = {
  mutateAsync: jest.fn(),
  isPending: false,
  isError: false,
  error: null as ApiError | null,
};
const mockSubmitIg = {
  mutateAsync: jest.fn(),
  isPending: false,
  isError: false,
  error: null,
};
const mockChangePassword = {
  mutateAsync: jest.fn(),
  isPending: false,
  isError: false,
  error: null,
};

jest.mock("../../api/hooks/useBrandHooks", () => ({
  useBrandProfile: () => ({
    data: {
      brandName: "Acme Coffee",
      companyEmail: "partnerships@acme.coffee",
      instagramHandle: "acmecoffee",
    },
  }),
  useBrandIgChangeRequestState: () => ({ data: { pending: null } }),
  useUpdateBrandProfile: () => mockUpdate,
  useSubmitBrandIgChangeRequest: () => mockSubmitIg,
  useChangeBrandPassword: () => mockChangePassword,
}));

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "brand" }, acceptSession: jest.fn() }),
}));

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("BrandSettingsPage name save placement", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    mockUpdate.mutateAsync.mockReset().mockResolvedValue({ brandName: "New Name" });
    mockUpdate.isPending = false;
    mockUpdate.isError = false;
    mockUpdate.error = null;
    mockSubmitIg.mutateAsync.mockReset();
    mockChangePassword.mutateAsync.mockReset();
  });

  function renderPage() {
    container = renderWithProviders(<BrandSettingsPage />, {
      route: "/brand/settings",
      path: "/brand/settings",
    }).container;
  }

  it("submits on Enter and shows the success message beside the name control", async () => {
    renderPage();
    const name = container.querySelector(
      '[data-testid="brand-name"]',
    ) as HTMLInputElement;
    const save = container.querySelector(
      '[data-testid="brand-name-save"]',
    ) as HTMLButtonElement;
    expect(name.parentElement?.parentElement?.parentElement).toBe(
      save.parentElement,
    );
    act(() => {
      setInputValue(name, "New Name");
    });
    await act(async () => {
      container.querySelector("form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });

    expect(mockUpdate.mutateAsync).toHaveBeenCalledWith({ brandName: "New Name" });
    expect(container.querySelector('[data-testid="brand-name-saved"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="brand-ig-change-open"]')).toBeTruthy();
  });

  it("keeps validation feedback associated with the name input beside Save", () => {
    mockUpdate.isError = true;
    mockUpdate.error = new ApiError(
      "VALIDATION_ERROR",
      "Request validation failed.",
      422,
      { errors: [{ loc: ["body", "brand_name"], msg: "Use at most 120 characters." }] },
    );
    renderPage();

    const name = container.querySelector('[data-testid="brand-name"]');
    const save = container.querySelector(
      '[data-testid="brand-name-save"]',
    ) as HTMLButtonElement;
    expect(name?.getAttribute("aria-invalid")).toBe("true");
    expect(name?.getAttribute("aria-describedby")).toBe("brand-name-error");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Use at most 120 characters.",
    );
    expect(save.disabled).toBe(false);
  });

  it("disables save for a blank name", () => {
    renderPage();
    const name = container.querySelector(
      '[data-testid="brand-name"]',
    ) as HTMLInputElement;
    const save = container.querySelector(
      '[data-testid="brand-name-save"]',
    ) as HTMLButtonElement;

    act(() => setInputValue(name, "   "));
    expect(save.disabled).toBe(true);
  });

  it("disables save while a save is pending", () => {
    mockUpdate.isPending = true;
    renderPage();
    expect(
      (container.querySelector('[data-testid="brand-name-save"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("keeps the Instagram change action independent", () => {
    renderPage();
    act(() => {
      (
        container.querySelector(
          '[data-testid="brand-ig-change-open"]',
        ) as HTMLButtonElement
      ).click();
    });

    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();
    expect(mockUpdate.mutateAsync).not.toHaveBeenCalled();
    expect(mockSubmitIg.mutateAsync).not.toHaveBeenCalled();
  });
});
