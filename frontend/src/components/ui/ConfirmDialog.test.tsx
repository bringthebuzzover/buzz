/**
 * The shared dialog shell: Escape closes and focus goes back to the trigger,
 * the dialog is labelled, and type-to-confirm gates the submit.
 */
import { useState } from "react";
import { act } from "react";
import { renderWithProviders } from "../../testUtils";
import { ConfirmDialog } from "./ConfirmDialog";

function Harness({ onConfirm }: { onConfirm: (typed: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="open" onClick={() => setOpen(true)}>
        Open
      </button>
      {open ? (
        <ConfirmDialog
          title="Hide campaign"
          description="Type the drop title to confirm."
          expected="Spring Drop"
          destructive
          confirmLabel="Hide campaign"
          onConfirm={onConfirm}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function setInput(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const q = <T extends Element>(selector: string) => document.querySelector(selector) as T | null;

describe("ConfirmDialog", () => {
  function open(onConfirm = jest.fn()) {
    renderWithProviders(<Harness onConfirm={onConfirm} />);
    const trigger = q<HTMLButtonElement>('[data-testid="open"]')!;
    trigger.focus();
    act(() => trigger.click());
    return trigger;
  }

  it("is a labelled dialog that closes on Escape and returns focus", async () => {
    const trigger = open();
    const dialog = q<HTMLElement>('[role="dialog"]')!;
    const title = document.getElementById(dialog.getAttribute("aria-labelledby")!);
    const desc = document.getElementById(dialog.getAttribute("aria-describedby")!);
    expect(title?.textContent).toBe("Hide campaign");
    expect(desc?.textContent).toBe("Type the drop title to confirm.");
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(q('[aria-label="Close"]')).not.toBeNull();

    act(() => {
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(q('[role="dialog"]')).toBeNull();
    // Radix hands focus back on the next tick after unmount.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps the submit disabled until the phrase matches", () => {
    const onConfirm = jest.fn();
    open(onConfirm);
    const submit = q<HTMLButtonElement>('[data-testid="confirm-submit"]')!;
    expect(submit.disabled).toBe(true);
    act(() => setInput(q<HTMLInputElement>('[data-testid="confirm-phrase"]')!, " Spring Drop "));
    expect(submit.disabled).toBe(false);
    act(() => submit.click());
    expect(onConfirm).toHaveBeenCalledWith(" Spring Drop ");
  });
});
