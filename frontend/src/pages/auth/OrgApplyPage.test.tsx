/**
 * Typed Instagram handle (§6.1.1): submit stays disabled until a handle is
 * entered, then the form posts that handle unconfirmed. Other field checks
 * still block submit.
 *
 * Uses react-dom (no @testing-library/react in this package).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mockApply = jest.fn();
const mockPrefill = {
  data: undefined as
    | {
        orgName: string;
        university: string;
        eduEmail: string;
        instagramHandle: string;
        memberCount: number;
        category: string;
        contactName: string;
        shippingLine1: string;
        shippingLine2: string | null;
        shippingCity: string;
        shippingState: string;
        shippingPostalCode: string;
        shippingRaw: string;
      }
    | undefined,
  isError: false,
  isPending: false,
  isSuccess: false,
};

jest.mock("../../api/hooks/useOnboardingHooks", () => ({
  useOrgApply: () => ({
    mutateAsync: mockApply,
    isPending: false,
  }),
  useOrgApplyPrefill: () => mockPrefill,
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

describe("OrgApplyPage typed Instagram handle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockApply.mockReset();
    mockPrefill.data = undefined;
    mockPrefill.isError = false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
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

  function setHandle(value: string) {
    const handleInput = container.querySelector(
      '[data-testid="org-apply-instagram"]',
    ) as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(handleInput, value);
      handleInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("keeps submit disabled until a handle is typed, then allows submit unconfirmed", async () => {
    mockApply.mockResolvedValue({ emailSent: true });
    renderPage();
    fillRequiredFieldsExceptHandle();

    const submit = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(container.textContent).not.toMatch(/confirm this is our organization/i);
    expect(container.textContent).toMatch(/Contact name/);
    expect(container.textContent).toMatch(/Shipping address/);

    setHandle("@campusgreeks");
    expect(submit.disabled).toBe(false);

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });

    expect(mockApply).toHaveBeenCalledWith(
      expect.objectContaining({
        instagramHandle: "campusgreeks",
        handleConfirmed: false,
      }),
    );
  });

  it("hydrates fields from a prefill draft without auto-confirming Instagram", () => {
    mockPrefill.data = {
      orgName: "Epsilon Nu Tau",
      university: "Cornell University",
      eduEmail: "mc3237@cornell.edu",
      instagramHandle: "entcornell",
      memberCount: 60,
      category: "sorority",
      contactName: "Melissa Chowdhury",
      shippingLine1: "121 Lake St",
      shippingLine2: null,
      shippingCity: "Ithaca",
      shippingState: "NY",
      shippingPostalCode: "14850",
      shippingRaw: "121 Lake St, Ithaca, NY 14850",
    };
    renderPage();
    const org = container.querySelector(
      '[data-testid="org-apply-org-name"]',
    ) as HTMLInputElement;
    expect(org.value).toBe("Epsilon Nu Tau");
    expect(
      (container.querySelector('[data-testid="org-apply-contact-name"]') as HTMLInputElement)
        .value,
    ).toBe("Melissa Chowdhury");
    expect(container.textContent).toMatch(/You wrote:/);
    const submit = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    expect(container.textContent).not.toMatch(/confirm this is our organization/i);
  });

  it("does not submit a Gmail address", async () => {
    mockApply.mockResolvedValue({ emailSent: true });
    renderPage();
    fillRequiredFieldsExceptHandle();
    setHandle("campusgreeks");

    const email = container.querySelector(
      '[data-testid="org-apply-edu-email"]',
    ) as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(email, "president@gmail.com");
      email.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });

    expect(mockApply).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Must be a valid \.edu email address/);
  });

  it("does not submit a decimal member count", async () => {
    renderPage();
    fillRequiredFieldsExceptHandle();
    setHandle("softfailorg");

    const members = container.querySelector(
      '[data-testid="org-apply-member-count"]',
    ) as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(members, "12.5");
      members.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
    expect(mockApply).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Enter a valid member count/);
  });

  it("does not submit a whitespace-only org name", async () => {
    renderPage();
    fillRequiredFieldsExceptHandle();
    setHandle("softfailorg");

    const org = container.querySelector(
      '[data-testid="org-apply-org-name"]',
    ) as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(org, "   ");
      org.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
    expect(mockApply).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Must not be empty/);
  });
});
