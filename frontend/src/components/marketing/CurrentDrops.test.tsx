/* eslint-disable testing-library/no-container -- the repo harness uses React DOM directly. */
import { renderWithProviders } from "../../testUtils";

const mockCatalog = jest.fn();
jest.mock("../../api/hooks/useDropHooks", () => ({
  usePublicDropCatalog: (...args: unknown[]) => mockCatalog(...args),
}));

import { CurrentDrops } from "./sections";

const row = {
  id: "00000000-0000-0000-0000-000000000123",
  brandName: "Acme",
  title: "Campus sampler",
  description: "A real campaign",
  image: "https://cdn.example.test/drop.webp",
  location: "Ithaca, NY",
  stage: "applying",
  applyOpenAt: 1,
  applyCloseAt: 2,
  capacityTotal: 10,
};

describe("CurrentDrops", () => {
  it("links catalog items to their canonical public detail pages", () => {
    mockCatalog.mockReturnValue({
      items: [row], isLoading: false, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    const { container } = renderWithProviders(<CurrentDrops />);
    expect(container.textContent).toContain("Campus sampler");
    expect(container.querySelector('a[href="/d/00000000-0000-0000-0000-000000000123"]')).not.toBeNull();
    expect(container.textContent).toContain("View drop");
  });

  it("shows loading, empty, and retryable error states", () => {
    mockCatalog.mockReturnValue({
      items: [], isLoading: true, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    const loading = renderWithProviders(<CurrentDrops />);
    expect(loading.container.textContent).toContain("Loading current drops");

    mockCatalog.mockReturnValue({
      items: [], isLoading: false, error: null, hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    const empty = renderWithProviders(<CurrentDrops />);
    expect(empty.container.textContent).toContain("No current drops right now");

    mockCatalog.mockReturnValue({
      items: [], isLoading: false, error: new Error("offline"), hasNextPage: false,
      fetchNextPage: jest.fn(), refetch: jest.fn(),
    });
    const failed = renderWithProviders(<CurrentDrops />);
    expect(failed.container.textContent).toContain("Could not load current drops");
    expect(failed.container.querySelector("button")?.textContent).toBe("Try again");
  });
});
