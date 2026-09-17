/**
 * Instagram identity: edit control → modal request; pending copy on the page.
 * Uses react-dom (no @testing-library/react in this package).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mockState = jest.fn();
const mockSubmit = jest.fn();

jest.mock("../../api/hooks/useOrgHooks", () => ({
  useOrgIgChangeRequestState: () => mockState(),
  useSubmitIgChangeRequest: () => ({
    mutateAsync: mockSubmit,
    isPending: false,
  }),
}));

import IgChangeRequestPanel from "./IgChangeRequestPanel";

const PENDING = {
  id: "req-1",
  orgId: "org-1",
  userId: "user-1",
  kind: "account_switch",
  status: "pending",
  currentHandle: "bringthebuzzover",
  requestedHandle: "newclubig",
  reason: "New chapter account",
  createdAt: 1,
};

function setInput(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("IgChangeRequestPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockState.mockReset();
    mockSubmit.mockReset();
    mockState.mockReturnValue({
      data: { pending: null },
      isPending: false,
    });
    mockSubmit.mockResolvedValue(PENDING);
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

  function render(handle = "bringthebuzzover") {
    act(() => {
      root.render(
        <IgChangeRequestPanel
          currentHandle={handle}
          connectEmail="maya@cornell.edu"
        />,
      );
    });
  }

  it("shows the handle and a request control, not the form", () => {
    render();
    expect(container.textContent).toContain("Instagram identity");
    expect(container.textContent).toContain("@bringthebuzzover");
    expect(container.textContent).toContain("Request a change");
    expect(container.textContent).not.toContain("read-only");
    expect(container.querySelector('[data-testid="ig-change-requested"]')).toBeNull();
    expect(document.querySelector('[data-testid="ig-change-requested"]')).toBeNull();
  });

  it("opens a modal with the request fields", () => {
    render();
    act(() => {
      (
        container.querySelector(
          '[data-testid="ig-change-open"]',
        ) as HTMLButtonElement
      ).click();
    });
    expect(document.body.textContent).toContain("Request an Instagram change");
    expect(document.querySelector('[data-testid="ig-change-requested"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="ig-change-current"]')).toBeNull();
    expect(document.querySelector('[data-testid="ig-change-reason"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="ig-change-submit"]')).toBeTruthy();
    expect(document.body.textContent).not.toContain("Type @");
    expect(document.body.textContent).not.toContain("What changed");
  });

  it("submits the request and closes the modal", async () => {
    render();
    act(() => {
      (
        container.querySelector(
          '[data-testid="ig-change-open"]',
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      setInput(
        document.querySelector(
          '[data-testid="ig-change-requested"]',
        ) as HTMLInputElement,
        "newclubig",
      );
      setInput(
        document.querySelector(
          '[data-testid="ig-change-reason"]',
        ) as HTMLInputElement,
        "New chapter account",
      );
    });
    await act(async () => {
      (
        document.querySelector(
          '[data-testid="ig-change-submit"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
    });
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(
      document.querySelector('[data-testid="ig-change-connect-email"]')
        ?.textContent,
    ).toBe("maya@cornell.edu");
    await act(async () => {
      (
        document.querySelector(
          '[data-testid="ig-change-confirm"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
    });
    expect(mockSubmit).toHaveBeenCalledWith({
      requestedHandle: "newclubig",
      reason: "New chapter account",
    });
    expect(document.querySelector('[data-testid="ig-change-requested"]')).toBeNull();
  });

  it("returns to the form without submitting when confirm is canceled", async () => {
    render();
    act(() => {
      (
        container.querySelector(
          '[data-testid="ig-change-open"]',
        ) as HTMLButtonElement
      ).click();
    });
    act(() => {
      setInput(
        document.querySelector(
          '[data-testid="ig-change-requested"]',
        ) as HTMLInputElement,
        "newclubig",
      );
      setInput(
        document.querySelector(
          '[data-testid="ig-change-reason"]',
        ) as HTMLInputElement,
        "New chapter account",
      );
    });
    await act(async () => {
      (
        document.querySelector(
          '[data-testid="ig-change-submit"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
    });
    await act(async () => {
      (
        document.querySelector(
          '[data-testid="ig-change-confirm-cancel"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
    });
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="ig-change-requested"]')).toBeTruthy();
  });

  it("shows submitted @old → @new under review and hides the request control", () => {
    mockState.mockReturnValue({
      data: { pending: PENDING },
      isPending: false,
    });
    render();
    expect(container.querySelector('[data-testid="ig-change-open"]')).toBeNull();
    expect(container.querySelector('[data-testid="ig-change-pending"]')?.textContent)
      .toContain("@bringthebuzzover → @newclubig");
    expect(container.textContent).toContain(
      "You submitted a request to change @bringthebuzzover to @newclubig. Under review.",
    );
  });
});
