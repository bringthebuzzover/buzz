/**
 * Pending-swap rotate panel: change CTA + pending Resend/Cancel.
 * Uses react-dom (no @testing-library/react in this package).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mockRotate = jest.fn();
const mockResend = jest.fn();
const mockCancel = jest.fn();

jest.mock("../../api/hooks/useOnboardingHooks", () => ({
  useRotateEduEmail: () => ({
    mutateAsync: mockRotate,
    isPending: false,
  }),
  useResendVerification: () => ({
    mutateAsync: mockResend,
    isPending: false,
  }),
  useCancelPendingEduEmail: () => ({
    mutateAsync: mockCancel,
    isPending: false,
  }),
}));

import EduEmailRotatePanel from "./EduEmailRotatePanel";

describe("EduEmailRotatePanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockRotate.mockReset();
    mockResend.mockReset();
    mockCancel.mockReset();
    mockRotate.mockResolvedValue({
      emailSentTo: "new@test.edu",
      pendingEduEmail: "new@test.edu",
      status: "active",
    });
    mockResend.mockResolvedValue({ emailSentTo: "new@test.edu" });
    mockCancel.mockResolvedValue({ ok: true, status: "active" });
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

  function render(props: {
    liveEmail?: string | null;
    pendingEmail?: string | null;
    onChanged?: () => Promise<unknown> | void;
  }) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <EduEmailRotatePanel
            liveEmail={props.liveEmail ?? "live@test.edu"}
            pendingEmail={props.pendingEmail}
            onChanged={props.onChanged ?? (() => undefined)}
          />
        </QueryClientProvider>,
      );
    });
  }

  it("shows live email and Change school email when no pending", () => {
    render({});
    expect(container.textContent).toContain("live@test.edu");
    expect(container.textContent).toContain("Change school email");
    expect(container.textContent).not.toContain("Pending change");
  });

  it("shows pending latch with Resend and Cancel change", () => {
    render({ pendingEmail: "new@test.edu" });
    expect(container.textContent).toContain("Pending change to");
    expect(container.textContent).toContain("new@test.edu");
    expect(container.textContent).toContain("Resend");
    expect(container.textContent).toContain("Cancel change");
  });

  it("Cancel change calls cancel mutation and onChanged", async () => {
    const onChanged = jest.fn(async () => undefined);
    render({ pendingEmail: "new@test.edu", onChanged });

    const cancelBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => /cancel change/i.test(b.textContent ?? ""),
    );
    expect(cancelBtn).toBeTruthy();

    await act(async () => {
      cancelBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Pending school email change canceled");
  });
});
