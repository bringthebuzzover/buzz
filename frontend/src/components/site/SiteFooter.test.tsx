/**
 * Footer columns: How it works vs Apply; org login stays in the header.
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

  it("splits tours and apply; omits org login", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <SiteFooter />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toMatch(/How it works/);
    expect(container.textContent).toMatch(/Apply as Org/);
    expect(container.textContent).toMatch(/Apply as Brand/);
    expect(container.querySelector('a[href="/for-orgs"]')).not.toBeNull();
    expect(container.querySelector('a[href="/login"]')).toBeNull();
    expect(container.textContent).not.toMatch(/Get Started/);
    expect(container.textContent).not.toMatch(/Org login/);
  });
});
