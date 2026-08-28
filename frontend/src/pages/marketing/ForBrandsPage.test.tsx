/**
 * /for-brands tour: ticket ≠ campaign, Publish, no self-serve mint.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import ForBrandsPage from "./ForBrandsPage";

describe("ForBrandsPage", () => {
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

  it("teaches ticket then Publish, not brand-minted live drops", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <ForBrandsPage />
        </MemoryRouter>,
      );
    });
    const text = container.textContent ?? "";
    expect(text).toMatch(/A representative will contact you/);
    expect(text).toMatch(/Publish/);
    expect(text).toMatch(/Awaiting Products/);
    expect(text).toMatch(/batch-finalize/);
    expect(text).not.toMatch(/placehold\.co/i);
    expect(text).not.toMatch(/Multiple Campuses/);
    expect(text).toMatch(/do not create a live campaign/i);

    const apply = container.querySelector('a[href="/brand/apply"]');
    expect(apply?.textContent).toMatch(/apply as a brand/i);
  });
});
