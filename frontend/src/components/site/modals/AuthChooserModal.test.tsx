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

  it("renders with default signup mode and title", () => {
    renderModal({ initialMode: "signup" });

    expect(
      document.body.querySelector("h2")?.textContent,
    ).toBe("How are you joining BUZZ?");
    expect(document.body.textContent).toContain("Organization");
    expect(document.body.textContent).toContain("Brand");
    expect(document.body.textContent).toContain("Free merch drops");
    expect(document.body.textContent).toContain("Campus reach");
  });

  it("renders with initial login mode and title", () => {
    renderModal({ initialMode: "login" });

    expect(
      document.body.querySelector("h2")?.textContent,
    ).toBe("How are you logging into BUZZ?");
  });

  it("switches mode between login and signup", () => {
    renderModal({ initialMode: "signup" });

    const loginTab = document.body.querySelector('button[role="tab"]:nth-child(1)') as HTMLButtonElement;
    expect(loginTab.textContent).toBe("Log in");

    click(loginTab);

    expect(
      document.body.querySelector("h2")?.textContent,
    ).toBe("How are you logging into BUZZ?");
  });

  it("selects organization card when clicked", () => {
    renderModal({ initialType: "brand" });

    const radios = document.body.querySelectorAll('[role="radio"]');
    expect(radios[0]?.getAttribute("aria-checked")).toBe("false");
    expect(radios[1]?.getAttribute("aria-checked")).toBe("true");

    click(radios[0]!);

    expect(radios[0]?.getAttribute("aria-checked")).toBe("true");
    expect(radios[1]?.getAttribute("aria-checked")).toBe("false");
  });

  it("navigates to /org/apply when continuing as Organization with signup", () => {
    renderModal({ initialMode: "signup", initialType: "organization" });

    const continueBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Continue"),
    );
    expect(continueBtn).toBeDefined();

    click(continueBtn!);

    expect(defaultOnSelect).toHaveBeenCalledWith("organization", "signup");
    expect(defaultOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/org/apply");
  });

  it("navigates to /login when continuing as Organization with login", () => {
    renderModal({ initialMode: "login", initialType: "organization" });

    const continueBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Continue"),
    );

    click(continueBtn!);

    expect(defaultOnSelect).toHaveBeenCalledWith("organization", "login");
    expect(defaultOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("navigates to /brand/apply when continuing as Brand with signup", () => {
    renderModal({ initialMode: "signup", initialType: "brand" });

    const continueBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Continue"),
    );

    click(continueBtn!);

    expect(defaultOnSelect).toHaveBeenCalledWith("brand", "signup");
    expect(defaultOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/brand/apply");
  });

  it("navigates to /brand/login when continuing as Brand with login", () => {
    renderModal({ initialMode: "login", initialType: "brand" });

    const continueBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Continue"),
    );

    click(continueBtn!);

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
