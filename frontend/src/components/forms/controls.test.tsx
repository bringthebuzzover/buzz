/**
 * Busy submit labels, generated field ids, and hint + aria-describedby merge.
 */
import { renderWithProviders as mount } from "../../testUtils";
import { Button, Select, TextArea, TextField } from "./controls";

describe("Button loading", () => {
  it("swaps in the busy label and stays disabled", () => {
    const view = mount(
      <Button loading loadingLabel="Signing in…">
        Sign in
      </Button>,
    );
    const button = view.container.querySelector("button");
    expect(button).toBeTruthy();
    expect(button!.disabled).toBe(true);
    expect(button!.getAttribute("aria-busy")).toBe("true");
    expect(button!.textContent).toBe("Signing in…");
  });

  it("keeps the idle label when a separate disabled reason is set", () => {
    const view = mount(<Button disabled>Submit application</Button>);
    const button = view.container.querySelector("button")!;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBeNull();
    expect(button.textContent).toBe("Submit application");
  });
});

describe("field ids and hints", () => {
  it("links a generated id to the label and hint", () => {
    const view = mount(
      <TextField label="Email" hint="We'll send a verification link here." />,
    );
    const input = view.container.querySelector("input")!;
    const label = view.container.querySelector("label")!;
    const hint = view.container.querySelector("p")!;
    expect(input.id).toBeTruthy();
    expect(label.htmlFor).toBe(input.id);
    expect(hint.id).toBe(`${input.id}-hint`);
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("merges a caller aria-describedby with the hint", () => {
    const view = mount(
      <TextField
        label="School (.edu) email"
        hint="We'll send a verification link here."
        aria-describedby="org-apply-edu-email-error"
      />,
    );
    const input = view.container.querySelector("input")!;
    const hint = view.container.querySelector("p")!;
    expect(input.getAttribute("aria-describedby")).toBe(
      `${hint.id} org-apply-edu-email-error`,
    );
  });

  it("generates ids for Select and TextArea", () => {
    const view = mount(
      <div>
        <Select label="Organization type" hint="Pick the closest fit.">
          <option value="">Select a type</option>
        </Select>
        <TextArea label="Notes" hint="Optional context." />
      </div>,
    );
    const select = view.container.querySelector("select")!;
    const textarea = view.container.querySelector("textarea")!;
    const labels = view.container.querySelectorAll("label");
    expect(labels[0].htmlFor).toBe(select.id);
    expect(labels[1].htmlFor).toBe(textarea.id);
    expect(select.getAttribute("aria-describedby")).toBe(`${select.id}-hint`);
    expect(textarea.getAttribute("aria-describedby")).toBe(`${textarea.id}-hint`);
  });
});
