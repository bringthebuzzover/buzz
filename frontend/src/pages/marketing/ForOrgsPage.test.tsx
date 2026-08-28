/**
 * /for-orgs tour: apply-first copy, confirm-card frame, apply CTA.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import ForOrgsPage from "./ForOrgsPage";

describe("ForOrgsPage", () => {
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

  it("shows Business or Creator, confirm card, and apply CTA", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <ForOrgsPage />
        </MemoryRouter>,
      );
    });
    const text = container.textContent ?? "";
    expect(text).toMatch(/Business or Creator/);
    expect(text).toMatch(/@cornellouting/);
    expect(text).toMatch(/Confirm this is our organization's account/);
    expect(text).toMatch(/Campus Kickoff 2026/);
    expect(text).not.toMatch(/placehold\.co/i);
    expect(text).not.toMatch(/Multiple Campuses/);
    expect(text).not.toMatch(/Continue with Instagram/);

    const apply = container.querySelector('a[href="/org/apply"]');
    expect(apply?.textContent).toMatch(/apply as a student organization/i);
    const login = container.querySelector('a[href="/login"]');
    expect(login).not.toBeNull();
  });
});
