/**
 * Confirm-card gating (§6.1.1): submit stays disabled until confirm, and soft-fail
 * unlocks submit without confirm.
 *
 * Uses react-dom (no @testing-library/react in this package).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mockLookup = jest.fn();
const mockApply = jest.fn();

jest.mock("../../api/hooks/useOnboardingHooks", () => ({
  useInstagramLookup: () => ({
    mutateAsync: mockLookup,
    isPending: false,
  }),
    useOrgApply: () => ({
      mutateAsync: mockApply,
      isPending: false,
    }),
    useAddressSuggest: () => ({
      mutateAsync: async () => ({ suggestions: [] }),
      isPending: false,
    }),
    useAddressPreview: () => ({
      mutateAsync: async () => {
        throw new Error("preview unused in this test");
      },
      isPending: false,
    }),
  }));

import OrgApplyPage from "./OrgApplyPage";

describe("OrgApplyPage confirm card", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    jest.useFakeTimers();
    mockLookup.mockReset();
    mockApply.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.useRealTimers();
  });

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <OrgApplyPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
  }

  function fillRequiredFieldsExceptHandle() {
    const inputs = Array.from(
      container.querySelectorAll("input, textarea, select"),
    ) as HTMLElement[];
    const byLabel = (text: string) => {
      const label = Array.from(container.querySelectorAll("label")).find((el) =>
        el.textContent?.includes(text),
      );
      const id = label?.getAttribute("for");
      if (id) {
        return container.querySelector(`#${id}`) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | null;
      }
      return label?.parentElement?.querySelector(
        "input, textarea, select",
      ) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    };

    const set = (
      el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null,
      value: string,
    ) => {
      if (!el) throw new Error("missing field");
      act(() => {
        const proto =
          el.tagName === "SELECT"
            ? HTMLSelectElement.prototype
            : el.tagName === "TEXTAREA"
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        setter?.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    };

    set(byLabel("Organization name"), "Campus Greeks");
    set(byLabel("University"), "Cornell University");
    set(byLabel("School (.edu) email"), "greeks@cornell.edu");
    set(byLabel("Number of members"), "40");
    set(byLabel("Organization type"), "sorority");
    set(byLabel("Contact name"), "Alex");
    set(byLabel("Street"), "123 College Ave");
    set(byLabel("City"), "Ithaca");
    set(byLabel("State"), "NY");
    set(byLabel("ZIP"), "14850");
    void inputs;
  }

  it("keeps submit disabled until the confirm card is confirmed", async () => {
    mockLookup.mockResolvedValue({
      available: true,
      username: "campusgreeks",
      name: "Campus Greeks",
      followersCount: 1200,
      biography: "Greek life",
      profilePictureUrl: null,
      reason: null,
    });
    renderPage();
    fillRequiredFieldsExceptHandle();

    const handleInput = Array.from(container.querySelectorAll("label"))
      .find((el) => el.textContent?.includes("Instagram handle"))
      ?.parentElement?.querySelector("input") as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(handleInput, "campusgreeks");
      handleInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      jest.advanceTimersByTime(600);
      await Promise.resolve();
    });

    const submit = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(container.textContent).toMatch(/@campusgreeks/i);
    expect(container.textContent).toMatch(/Contact name/);
    expect(container.textContent).toMatch(/Shipping address/);

    const confirm = Array.from(container.querySelectorAll("button")).find((b) =>
      /confirm this is our organization/i.test(b.textContent || ""),
    );
    expect(confirm).toBeTruthy();
    act(() => {
      confirm!.click();
    });
    expect(submit.disabled).toBe(false);
  });

  it("allows submit on soft-fail without confirm", async () => {
    mockLookup.mockResolvedValue({
      available: false,
      username: null,
      name: null,
      followersCount: null,
      biography: null,
      profilePictureUrl: null,
      reason: "unavailable",
    });
    renderPage();
    fillRequiredFieldsExceptHandle();

    const handleInput = Array.from(container.querySelectorAll("label"))
      .find((el) => el.textContent?.includes("Instagram handle"))
      ?.parentElement?.querySelector("input") as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(handleInput, "softfailorg");
      handleInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      jest.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/couldn.?t verify that handle/i);
    const submit = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });
});
