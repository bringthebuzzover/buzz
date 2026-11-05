/* eslint-disable testing-library/no-container -- Shared harness uses React DOM; Testing Library is not installed. */
import { act } from "react";
import { renderWithProviders } from "../../../testUtils";
import ContactModal from "./ContactModal";

describe("ContactModal", () => {
  it("renders Contact modal with Instagram, LinkedIn, and Email in order without Name", () => {
    const onClose = jest.fn();
    renderWithProviders(<ContactModal onClose={onClose} />);

    // Radix Dialog.Portal renders into document.body
    const modalContent = document.body;

    // Title and description
    expect(modalContent.textContent).toContain("Contact");
    expect(modalContent.textContent).toContain("Reach out anytime!");

    // Name field must be completely removed
    expect(modalContent.textContent).not.toContain("Buzz team");
    expect(modalContent.textContent).not.toContain("Name");

    // Channels in strict order: Instagram -> LinkedIn -> Email
    const channelCards = Array.from(modalContent.querySelectorAll("a"));
    expect(channelCards).toHaveLength(3);

    // 1. Instagram
    expect(channelCards[0].textContent).toContain("Instagram");
    expect(channelCards[0].textContent).toContain("@bringthebuzzover");
    expect(channelCards[0].getAttribute("href")).toBe("https://instagram.com/bringthebuzzover");
    expect(channelCards[0].getAttribute("target")).toBe("_blank");
    expect(channelCards[0].getAttribute("rel")).toBe("noopener noreferrer");

    // 2. LinkedIn
    expect(channelCards[1].textContent).toContain("LinkedIn");
    expect(channelCards[1].textContent).toContain("Bring the Buzz Over");
    expect(channelCards[1].getAttribute("href")).toBe(
      "https://www.linkedin.com/company/bringthebuzzover/",
    );
    expect(channelCards[1].getAttribute("target")).toBe("_blank");
    expect(channelCards[1].getAttribute("rel")).toBe("noopener noreferrer");

    // 3. Email
    expect(channelCards[2].textContent).toContain("Email");
    expect(channelCards[2].textContent).toContain("hello@bringthebuzzover.com");
    expect(channelCards[2].getAttribute("href")).toBe("mailto:hello@bringthebuzzover.com");

    // Clicking Done dismisses modal
    const doneButton = Array.from(modalContent.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Done",
    );
    expect(doneButton).toBeDefined();
    act(() => {
      doneButton?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
