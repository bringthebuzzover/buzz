/**
 * Brand apply form — Batch 6's five required fields.
 *
 * Locks the payload the backend expects: contact name, brand name, company
 * email, a marketing-budget code from the shared list, and the message. The
 * budget dropdown must offer exactly the contract codes.
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

function fieldByLabel(root: HTMLElement, label: string) {
  const labels = Array.from(root.querySelectorAll("label"));
  const match = labels.find((node) => node.textContent?.trim() === label);
  expect(match).toBeTruthy();
  const id = match!.getAttribute("for");
  // React's useId emits `:r0:`-style ids, which are not valid CSS selectors.
  return root.querySelector(`[id="${id}"]`) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement;
}

describe("BrandApplyPage", () => {
  // Declared here, not destructured from the render call, so the container is
  // only reachable through this describe — the same shape as the admin page
  // tests, and what testing-library/no-container expects.
  let container: HTMLDivElement;

  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({ brandId: "brand-1", status: "pending_review" });
  });

  it("keeps the five required fields and offers optional discovery choices", () => {
    ({ container } = renderWithProviders(<BrandApplyPage />));

    const labels = Array.from(container.querySelectorAll("label[for]")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    expect(labels).toEqual([
      "Your name",
      "Company name",
      "Company email",
      "University marketing budget",
      "What are you hoping to do on BUZZ?",
    ]);

    const choices = Array.from(
      container.querySelectorAll<HTMLInputElement>('[role="radiogroup"] input[type="radio"]'),
    );
    expect(choices.map((choice) => choice.value)).toEqual([
      "linkedin",
      "instagram",
      "referral",
      "search_engine",
      "other",
    ]);
    expect(choices.every((choice) => !choice.required && !choice.checked)).toBe(true);

    const budget = fieldByLabel(container, "University marketing budget");
    expect(Array.from(budget.querySelectorAll("option")).map((o) => o.value)).toEqual([
      "",
      "5_20k",
      "20k_50k",
      "50k_100k",
      "100k_plus",
    ]);

    for (const label of labels) {
      expect((fieldByLabel(container, label) as HTMLInputElement).required).toBe(true);
    }
  });

  it("submits trimmed values, the budget code, and the custom discovery answer", async () => {
    ({ container } = renderWithProviders(<BrandApplyPage />));

    setValue(fieldByLabel(container, "Your name"), "  Ada Lovelace ");
    setValue(fieldByLabel(container, "Company name"), " Acme Co ");
    setValue(fieldByLabel(container, "Company email"), " Ada@Acme.test ");
    setValue(fieldByLabel(container, "University marketing budget"), "20k_50k");
    setValue(
      fieldByLabel(container, "What are you hoping to do on BUZZ?"),
      " Sample our cold brew ",
    );

    const other = container.querySelector<HTMLInputElement>('input[type="radio"][value="other"]')!;
    act(() => other.click());
    const detail = container.querySelector<HTMLInputElement>('[aria-label="Specify how you found us"]')!;
    setValue(detail, "  Campus newsletter  ");

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
      howFound: "other",
      howFoundOther: "Campus newsletter",
    });
  });
});
