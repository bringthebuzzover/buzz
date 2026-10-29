/**
 * /for-orgs tour: apply-first copy, typed Instagram handle, apply CTA.
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

  it("shows Business or Creator, the typed handle, and apply CTA", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <ForOrgsPage />
        </MemoryRouter>,
      );
    });
    const text = container.textContent ?? "";
    expect(text).toMatch(/Business or Creator/);
    expect(text).toMatch(/@sampleorg/);
    expect(text).not.toMatch(/Confirm this is our organization's account/);
    expect(text).not.toMatch(/confirm card/i);
    expect(text).toMatch(/Continue with Instagram/);
    expect(text).not.toMatch(/placehold\.co/i);
    const hero = container.querySelector('img[alt="Kappa Alpha Theta x Yerba Madre"]');
    expect(hero).not.toBeNull();
    expect(text).not.toMatch(/Multiple Campuses/);

    const apply = container.querySelector('a[href="/org/apply"]');
    expect(apply?.textContent).toMatch(/apply as an organization|join us|join as a student organization/i);
    const login = container.querySelector('a[href="/login"]');
    expect(login).not.toBeNull();
  });
});
