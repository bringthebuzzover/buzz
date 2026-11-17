import { act } from "react";
import { renderWithProviders } from "../../../testUtils";
import AuthChooserModal, { type AuthMode, type AccountType } from "./AuthChooserModal";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

describe("AuthChooserModal", () => {
  const defaultOnClose = jest.fn();
  const defaultOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderModal(props?: {
    isOpen?: boolean;
    initialMode?: AuthMode;
    initialType?: AccountType;
    onClose?: () => void;
    onSelect?: (type: AccountType, mode: AuthMode) => void;
  }) {
    return renderWithProviders(
      <AuthChooserModal
        isOpen={props?.isOpen ?? true}
        initialMode={props?.initialMode ?? "signup"}
        initialType={props?.initialType ?? "brand"}
        onClose={props?.onClose ?? defaultOnClose}
        onSelect={props?.onSelect ?? defaultOnSelect}
      />,
    );
  }

  it("renders with default signup mode and title without top badge or tags", () => {
    renderModal({ initialMode: "signup" });

    expect(
      document.body.querySelector("h2")?.textContent,
    ).toBe("How are you joining BUZZ?");
    expect(document.body.textContent).toContain("Organization");
    expect(document.body.textContent).toContain("Brand");

    // Verified: no top kicker badge or tags
    expect(document.body.textContent).not.toContain("JOIN THE COMMUNITY");
    expect(document.body.textContent).not.toContain("WELCOME BACK");
    expect(document.body.textContent).not.toContain("Free merch drops");
    expect(document.body.textContent).not.toContain("Campus reach");
    expect(document.body.textContent).not.toContain("Continue");
  });

  it("renders with initial login mode and title", () => {
    renderModal({ initialMode: "login" });

    expect(
      document.body.querySelector("h2")?.textContent,
    ).toBe("How are you logging into BUZZ?");
  });

  it("switches mode between login and signup", () => {
    renderModal({ initialMode: "signup" });

    const loginBtn = document.body.querySelector('button[aria-pressed]:nth-child(1)') as HTMLButtonElement;
    expect(loginBtn.textContent).toBe("Log in");

    click(loginBtn);

    expect(
      document.body.querySelector("h2")?.textContent,
    ).toBe("How are you logging into BUZZ?");
  });

  it("directly navigates to /org/apply when clicking Organization card in signup mode", () => {
    renderModal({ initialMode: "signup" });

    const cards = Array.from(document.body.querySelectorAll('div[aria-label="Account type"] button'));
    const orgCard = cards.find((b) => b.textContent?.includes("Organization"))!;
    expect(orgCard).toBeDefined();
    click(orgCard);

    expect(defaultOnSelect).toHaveBeenCalledWith("organization", "signup");
    expect(defaultOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/org/apply");
  });

  it("directly navigates to /login when clicking Organization card in login mode", () => {
    renderModal({ initialMode: "login" });

    const cards = Array.from(document.body.querySelectorAll('div[aria-label="Account type"] button'));
    const orgCard = cards.find((b) => b.textContent?.includes("Organization"))!;
    expect(orgCard).toBeDefined();
    click(orgCard);

    expect(defaultOnSelect).toHaveBeenCalledWith("organization", "login");
    expect(defaultOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("directly navigates to /brand/apply when clicking Brand card in signup mode", () => {
    renderModal({ initialMode: "signup" });

    const cards = Array.from(document.body.querySelectorAll('div[aria-label="Account type"] button'));
    const brandCard = cards.find((b) => b.textContent?.includes("Brand"))!;
    expect(brandCard).toBeDefined();
    click(brandCard);

    expect(defaultOnSelect).toHaveBeenCalledWith("brand", "signup");
    expect(defaultOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/brand/apply");
  });

  it("directly navigates to /brand/login when clicking Brand card in login mode", () => {
    renderModal({ initialMode: "login" });

    const cards = Array.from(document.body.querySelectorAll('div[aria-label="Account type"] button'));
    const brandCard = cards.find((b) => b.textContent?.includes("Brand"))!;
    expect(brandCard).toBeDefined();
    click(brandCard);

    expect(defaultOnSelect).toHaveBeenCalledWith("brand", "login");
    expect(defaultOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/brand/login");
  });

  it("calls onClose when close button is clicked", () => {
    renderModal();

    const closeBtn = document.body.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    click(closeBtn);

    expect(defaultOnClose).toHaveBeenCalled();
  });
});
