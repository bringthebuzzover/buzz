/**
 * Compact footer (pen Site / Footer): tours, apply, and both logins.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import SiteFooter from "./SiteFooter";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

jest.mock("../../contexts/SiteChromeContext", () => ({
  useSiteChrome: () => ({ openContactModal: jest.fn() }),
}));

describe("SiteFooter", () => {
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

  it("lists tours, apply, and both portal logins", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <SiteFooter />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toMatch(/How it works/);
    expect(container.textContent).toMatch(/Get started/);
    expect(container.textContent).toMatch(/Apply as Organization/);
    expect(container.textContent).toMatch(/Apply as Brand/);
    expect(container.textContent).toMatch(/Organization login/);
    expect(container.textContent).toMatch(/Brand login/);
    expect(container.querySelector('a[href="/for-orgs"]')).not.toBeNull();
    expect(container.querySelector('a[href="/login"]')).not.toBeNull();
    expect(container.querySelector('a[href="/brand/login"]')).not.toBeNull();
  });
});
