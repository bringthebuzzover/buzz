/**
 * `/drop-editor`: admin and brand modes, the TODAY-marked date picker,
 * rename with reset, the description modal, and the live preview card.
 * Uses react-dom (no @testing-library/react in this package).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import DropEditorPage from "./DropEditorPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = new Date(2026, 9, 27);

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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

function mount(search = "") {
  // react-dom's root.render, not Testing Library's render, so act is needed here.
  // eslint-disable-next-line testing-library/no-unnecessary-act
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[`/drop-editor${search}`]}>
        <DropEditorPage today={TODAY} />
      </MemoryRouter>,
    );
  });
}

const text = () => container.textContent ?? "";

function button(label: string | RegExp): HTMLButtonElement {
  const all = Array.from(container.querySelectorAll("button"));
  const match = all.find((b) => {
    const name = b.getAttribute("aria-label") ?? b.textContent ?? "";
    return typeof label === "string" ? name.trim() === label : label.test(name);
  });
  if (!match) throw new Error(`No button ${String(label)}`);
  return match;
}

function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function key(el: Element, k: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
  });
}

const cardTitle = () => container.querySelector(".de-cover-over h3")?.textContent;

describe("DropEditorPage", () => {
  it("renders the admin editor with settings and Save drop", () => {
    mount();
    expect(text()).toContain("New drop");
    expect(text()).toContain("Application window");
    expect(text()).toContain("Settings");
    expect(text()).toContain("Content only");
    expect(button("Save drop")).toBeTruthy();
    expect(text()).not.toContain("Anything else?");
  });

  it("switches to brand copy with ?mode=brand", () => {
    mount("?mode=brand");
    expect(text()).toContain("Request a drop");
    expect(text()).toContain("Preferred timing");
    expect(text()).toContain("Not sure yet");
    expect(text()).toContain("Ballpark is fine");
    expect(text()).toContain("Anything else?");
    expect(text()).not.toContain("Settings");
    expect(text()).not.toContain("Save drop");
    expect(button("Send request")).toBeTruthy();
  });

  it("marks today and applies a new range to the rows and preview", () => {
    mount("?pop=1");
    const today = button("Tue, Oct 27, today");
    expect(today.getAttribute("aria-current")).toBe("date");
    expect(container.querySelector(".de-day.is-today .de-today-label")?.textContent).toBe("Today");
    expect(button("Next 2 weeks").getAttribute("aria-pressed")).toBe("true");
    expect(button(/Apply · 12 days/).disabled).toBe(false);
    expect(button("Mon, Oct 26").disabled).toBe(true);

    click(button("Wed, Nov 4"));
    click(button("Tue, Nov 10"));
    expect(button("Custom").getAttribute("aria-pressed")).toBe("true");
    click(button(/Apply · 7 days/));

    expect(container.querySelector(".de-pop")).toBeNull();
    expect(text()).toContain("Wed, Nov 4");
    expect(text()).toContain("Applications open Nov 4");
    expect(container.querySelector(".de-card-meta")?.textContent).toContain("Nov 10");
  });

  it("clears the range and disables Apply", () => {
    mount("?pop=1");
    click(button("Clear"));
    expect(button("Apply").disabled).toBe(true);
  });

  it("renames the drop and resets to the default name", () => {
    mount();
    click(container.querySelector(".de-title-btn") as Element);
    const input = container.querySelector(".de-title-input") as HTMLInputElement;
    expect(text()).toContain("Reset to default");
    type(input, "Fall sampling");
    key(input, "Enter");
    expect(cardTitle()).toBe("Fall sampling");

    click(container.querySelector(".de-title-btn") as Element);
    click(button("Reset to default"));
    key(container.querySelector(".de-title-input") as Element, "Enter");
    expect(cardTitle()).toBe("Yerba Madrex BUZZ");
  });

  it("edits the description in its modal with a counter", () => {
    mount("?desc=1");
    const field = container.querySelector(".de-modal textarea") as HTMLTextAreaElement;
    expect(text()).toContain("Shown on the drop card: first line only");
    type(field, "Try the new flavor.");
    expect(text()).toContain("19 / 600");
    click(button("Save"));
    expect(container.querySelector(".de-modal")).toBeNull();
    expect(container.querySelector(".de-card-body p")?.textContent).toBe("Try the new flavor.");
  });

  it("removes a campus and updates the preview count", () => {
    mount();
    click(button("Remove Brown"));
    expect(text()).not.toContain("Brown");
    expect(container.querySelector(".de-card-meta")?.textContent).toContain("Campuses2");
  });
});
