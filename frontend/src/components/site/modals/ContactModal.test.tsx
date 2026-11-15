/* eslint-disable testing-library/no-container -- Shared harness uses React DOM; Testing Library is not installed. */
import { act } from "react";
import { renderWithProviders } from "../../../testUtils";
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
});
