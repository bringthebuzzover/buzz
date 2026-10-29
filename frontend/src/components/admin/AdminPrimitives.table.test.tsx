/**
 * Hybrid-card labels are injected from `headers`. JSX whitespace between
 * <Cell>s is a child of <Row>; indexing that as a column mislabels every field.
 */
import { renderWithProviders } from "../../testUtils";

import { AdminTable, Cell, Row } from "./AdminPrimitives";

describe("AdminTable hybrid cell labels", () => {
  let container: HTMLDivElement;

  it("maps headers onto Cell columns, ignoring whitespace between them", () => {
    container = renderWithProviders(
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
    ).container;

    const cells = Array.from(container.querySelectorAll("td"));
    expect(cells).toHaveLength(3);
    expect(cells[0].textContent).toBe("Greeks");
    expect(cells[1].textContent).toContain("University");
    expect(cells[1].textContent).toContain("Cornell");
    expect(cells[2].textContent).toBe("View as");
  });
});
