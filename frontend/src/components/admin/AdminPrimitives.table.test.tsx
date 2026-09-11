/**
 * Hybrid-card labels are injected from `headers`. JSX whitespace between
 * <Cell>s is a child of <Row>; indexing that as a column mislabels every field.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { AdminTable, Cell, Row } from "./AdminPrimitives";

describe("AdminTable hybrid cell labels", () => {
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

  it("maps headers onto Cell columns, ignoring whitespace between them", () => {
    act(() => {
      root.render(
        <AdminTable
          headers={["Organization", "University", ""]}
          isEmpty={false}
          empty="none"
        >
          <Row>
            <Cell>Greeks</Cell>
            <Cell>Cornell</Cell>
            <Cell>View as</Cell>
          </Row>
        </AdminTable>,
      );
    });

    const cells = Array.from(container.querySelectorAll("td"));
    expect(cells).toHaveLength(3);
    expect(cells[0].textContent).toBe("Greeks");
    expect(cells[1].textContent).toContain("University");
    expect(cells[1].textContent).toContain("Cornell");
    expect(cells[2].textContent).toBe("View as");
  });
});
