/**
 * Brand apply form — Batch 6's five required fields, in order.
 *
 * Locks the payload the backend expects: contact name, brand name, company
 * email, a marketing-budget code from the shared list, and the message. The
 * budget `<select>` must offer exactly the contract codes.
 */
import { act } from "react";
import { renderWithProviders } from "../../testUtils";

import BrandApplyPage from "./BrandApplyPage";

const mockMutateAsync = jest.fn();

jest.mock("../../api/hooks/useOnboardingHooks", () => ({
  usePublicConfig: () => ({
    data: { brandSelfRegistrationEnabled: true },
    isLoading: false,
  }),
  useBrandApply: () => ({
    mutateAsync: (...args: unknown[]) => mockMutateAsync(...args),
    isPending: false,
  }),
}));

function setValue(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    if (el instanceof HTMLSelectElement) {
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

function fieldByLabel(container: HTMLElement, label: string) {
  const labels = Array.from(container.querySelectorAll("label"));
  const match = labels.find((node) => node.textContent?.trim() === label);
  expect(match).toBeTruthy();
  const id = match!.getAttribute("for");
  // React's useId emits `:r0:`-style ids, which are not valid CSS selectors.
  return container.querySelector(`[id="${id}"]`) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement;
}

describe("BrandApplyPage", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({ brandId: "brand-1", status: "pending_review" });
  });

  it("asks for the five required fields plus an optional handle", () => {
    const { container } = renderWithProviders(<BrandApplyPage />);

    const labels = Array.from(container.querySelectorAll("label")).map((node) =>
      node.textContent?.trim(),
    );
    expect(labels).toEqual([
      "Your name",
      "Brand name",
      "Company email",
      "University marketing budget",
      "What are you hoping to do on BUZZ?",
      "Instagram handle (optional)",
    ]);

    const budget = fieldByLabel(container, "University marketing budget");
    expect(Array.from(budget.querySelectorAll("option")).map((o) => o.value)).toEqual([
      "",
      "5_20k",
      "20k_50k",
      "50k_100k",
      "100k_plus",
    ]);

    for (const label of [
      "Your name",
      "Brand name",
      "Company email",
      "University marketing budget",
      "What are you hoping to do on BUZZ?",
    ]) {
      expect((fieldByLabel(container, label) as HTMLInputElement).required).toBe(true);
    }
    expect(
      (fieldByLabel(container, "Instagram handle (optional)") as HTMLInputElement)
        .required,
    ).toBe(false);
  });

  it("submits trimmed values, the budget code, and no handle when blank", async () => {
    const { container } = renderWithProviders(<BrandApplyPage />);

    setValue(fieldByLabel(container, "Your name"), "  Ada Lovelace ");
    setValue(fieldByLabel(container, "Brand name"), " Acme Co ");
    setValue(fieldByLabel(container, "Company email"), " Ada@Acme.test ");
    setValue(fieldByLabel(container, "University marketing budget"), "20k_50k");
    setValue(
      fieldByLabel(container, "What are you hoping to do on BUZZ?"),
      " Sample our cold brew ",
    );
    setValue(fieldByLabel(container, "Instagram handle (optional)"), "  ");

    await act(async () => {
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      contactName: "Ada Lovelace",
      brandName: "Acme Co",
      companyEmail: "Ada@Acme.test",
      marketingBudget: "20k_50k",
      intentMessage: "Sample our cold brew",
      instagramHandle: undefined,
    });
  });

  it("strips a leading @ from the Instagram handle", async () => {
    const { container } = renderWithProviders(<BrandApplyPage />);

    setValue(fieldByLabel(container, "Your name"), "Ada");
    setValue(fieldByLabel(container, "Brand name"), "Acme");
    setValue(fieldByLabel(container, "Company email"), "ada@acme.test");
    setValue(fieldByLabel(container, "University marketing budget"), "5_20k");
    setValue(fieldByLabel(container, "What are you hoping to do on BUZZ?"), "Hi");
    setValue(fieldByLabel(container, "Instagram handle (optional)"), "@acme");

    await act(async () => {
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ instagramHandle: "acme" }),
    );
  });
});
