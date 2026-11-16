/* eslint-disable testing-library/no-container -- Shared harness uses React DOM; Testing Library is not installed. */
import { act } from "react";
import { renderWithProviders } from "../../../testUtils";
import { ApiError } from "../../../api/errors";
import { VALIDATION_FALLBACK } from "../../../api/userFacingError";
import ContactModal from "./ContactModal";

const mockMutateAsync = jest.fn();
let mockSuccess = false;

jest.mock("../../../api/hooks/useContactHooks", () => ({
  useSubmitContact: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    isSuccess: mockSuccess,
  }),
}));

jest.mock("../../../data/siteIdentity", () => ({
  siteIdentity: {
    brand: { displayName: "Bring the Buzz Over" },
    social: {
      instagram: {
        handleWithAt: "@exampleorg",
        webUrl: "https://instagram.com/exampleorg",
      },
      linkedin: { companyUrl: "https://www.linkedin.com/company/example/" },
    },
    contact: { primaryPersonName: "Buzz team", email: "hello@example.com" },
  },
}));

/** Radix portals the dialog into document.body, so queries go there. */
function field(id: string): HTMLInputElement | HTMLTextAreaElement | null {
  return document.body.querySelector(`#${id}`);
}

function setInput(id: string, value: string) {
  const el = field(id) as HTMLInputElement | HTMLTextAreaElement;
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function submit() {
  return act(async () => {
    document.body
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("ContactModal", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({ accepted: true });
    mockSuccess = false;
    document.body.innerHTML = "";
  });

  it("renders the message form and the three channels from siteIdentity", () => {
    renderWithProviders(<ContactModal onClose={jest.fn()} />);

    expect(field("contact-first-name")).not.toBeNull();
    expect(field("contact-last-name")).not.toBeNull();
    expect(field("contact-email")).not.toBeNull();
    expect(field("contact-message")).not.toBeNull();

    // Channels come from siteIdentity, not hardcoded copy.
    expect(document.body.textContent).toContain("@exampleorg");
    expect(document.body.textContent).toContain("Bring the Buzz Over");
    expect(document.body.textContent).toContain("hello@example.com");

    // The old read-only "Done"-card layout is gone.
    expect(
      Array.from(document.body.querySelectorAll("button")).some(
        (b) => b.textContent === "Done",
      ),
    ).toBe(false);
  });

  it("posts the form once with the honeypot left empty", async () => {
    renderWithProviders(<ContactModal onClose={jest.fn()} />);

    setInput("contact-first-name", "Jordan");
    setInput("contact-email", "jordan@example.edu");
    setInput("contact-message", "We want to run a drop.");
    await submit();

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({
      firstName: "Jordan",
      lastName: "",
      email: "jordan@example.edu",
      message: "We want to run a drop.",
      website: "",
    });
  });

  it("keeps what the user typed when the send fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("network down"));
    renderWithProviders(<ContactModal onClose={jest.fn()} />);

    setInput("contact-first-name", "Jordan");
    setInput("contact-email", "jordan@example.edu");
    setInput("contact-message", "Please keep this text.");
    await submit();

    // Still on the form with the body intact — nothing lost.
    const message = field("contact-message") as HTMLTextAreaElement;
    expect(message).not.toBeNull();
    expect(message.value).toBe("Please keep this text.");
  });

  it("includes the honeypot field so a bot can fill it", () => {
    renderWithProviders(<ContactModal onClose={jest.fn()} />);

    const honeypot = field("contact-website") as HTMLInputElement;
    expect(honeypot).not.toBeNull();
    expect(honeypot.getAttribute("tabindex")).toBe("-1");
    expect(honeypot.getAttribute("autocomplete")).toBe("off");
  });

  it("replaces the form with a confirmation after a successful send", () => {
    mockSuccess = true;
    renderWithProviders(<ContactModal onClose={jest.fn()} />);

    expect(document.body.textContent).toContain("Thanks");
    // Form gone, so nothing can be submitted twice.
    expect(document.body.querySelector("form")).toBeNull();
  });

  it("renders a server 422 on the field it names, not as a silent failure", async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError("VALIDATION_ERROR", "Request validation failed.", 422, {
        errors: [{ loc: ["body", "email"], msg: "Value error, Invalid email address" }],
      }),
    );
    renderWithProviders(<ContactModal onClose={jest.fn()} />);

    setInput("contact-first-name", "Jordan");
    setInput("contact-email", "jordan@example.edu");
    setInput("contact-message", "We want to run a drop.");
    await submit();

    const email = field("contact-email") as HTMLInputElement;
    // The primitive wires aria-invalid + aria-describedby to the message.
    expect(email.getAttribute("aria-invalid")).toBe("true");
    const describedBy = email.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const message = document.body.querySelector(`#${describedBy!.split(/\s+/)[0]}`);
    // Framework "Value error, " prefix is stripped.
    expect(message?.textContent).toBe("Invalid email address");
    // Field-level only: no redundant banner.
    expect(document.body.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("splits a multi-field 422 across the controls it names", async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError("VALIDATION_ERROR", "Request validation failed.", 422, {
        errors: [
          { loc: ["body", "first_name"], msg: "Value error, First name is required" },
          { loc: ["body", "message"], msg: "Value error, Message is required" },
        ],
      }),
    );
    renderWithProviders(<ContactModal onClose={jest.fn()} />);
    setInput("contact-first-name", "Jordan");
    setInput("contact-email", "jordan@example.edu");
    setInput("contact-message", "x");
    await submit();

    const firstName = field("contact-first-name") as HTMLInputElement;
    const body = field("contact-message") as HTMLTextAreaElement;
    expect(firstName.getAttribute("aria-invalid")).toBe("true");
    expect(body.getAttribute("aria-invalid")).toBe("true");
    expect(document.body.textContent).toContain("First name is required");
    expect(document.body.textContent).toContain("Message is required");
  });

  it("shows a banner when a 422 names no field this form owns", async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError("VALIDATION_ERROR", "Request validation failed.", 422, {
        errors: [{ loc: ["body", "something_else"], msg: "Value error, Nope" }],
      }),
    );
    renderWithProviders(<ContactModal onClose={jest.fn()} />);
    setInput("contact-first-name", "Jordan");
    setInput("contact-email", "jordan@example.edu");
    setInput("contact-message", "x");
    await submit();

    // Nothing can ever be silent: the server's own message reaches the banner.
    const banner = document.body.querySelector('[role="alert"]');
    expect(banner?.textContent).toContain("Nope");
  });

  it("shows the generic validation banner when details resolve to nothing", async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError("VALIDATION_ERROR", "Request validation failed.", 422, {
        errors: [{ loc: ["body", "something_else"], msg: "" }],
      }),
    );
    renderWithProviders(<ContactModal onClose={jest.fn()} />);
    setInput("contact-first-name", "Jordan");
    setInput("contact-email", "jordan@example.edu");
    setInput("contact-message", "x");
    await submit();

    const banner = document.body.querySelector('[role="alert"]');
    expect(banner?.textContent).toBe(VALIDATION_FALLBACK);
  });

  it("shows a banner when the error carries no validation details at all", async () => {
    mockMutateAsync.mockRejectedValueOnce(new ApiError("INTERNAL_ERROR", "", 500, null));
    renderWithProviders(<ContactModal onClose={jest.fn()} />);
    setInput("contact-first-name", "Jordan");
    setInput("contact-email", "jordan@example.edu");
    setInput("contact-message", "x");
    await submit();

    const banner = document.body.querySelector('[role="alert"]');
    expect(banner?.textContent).toBe("We couldn't send that. Please try again.");
  });

  it("clears field errors and the banner on the next attempt", async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError("VALIDATION_ERROR", "Request validation failed.", 422, {
        errors: [{ loc: ["body", "email"], msg: "Value error, Invalid email address" }],
      }),
    );
    renderWithProviders(<ContactModal onClose={jest.fn()} />);
    setInput("contact-first-name", "Jordan");
    setInput("contact-email", "jordan@example.edu");
    setInput("contact-message", "x");
    await submit();
    expect((field("contact-email") as HTMLInputElement).getAttribute("aria-invalid")).toBe(
      "true",
    );

    await submit();

    const email = field("contact-email") as HTMLInputElement;
    expect(email.getAttribute("aria-invalid")).toBeNull();
    expect(document.body.querySelector('[role="alert"]')).toBeNull();
  });

  it("caps each field at the backend's length limit", () => {
    renderWithProviders(<ContactModal onClose={jest.fn()} />);

    expect((field("contact-first-name") as HTMLInputElement).maxLength).toBe(100);
    expect((field("contact-last-name") as HTMLInputElement).maxLength).toBe(100);
    expect((field("contact-email") as HTMLInputElement).maxLength).toBe(320);
    expect((field("contact-message") as HTMLTextAreaElement).maxLength).toBe(2000);
  });
});
