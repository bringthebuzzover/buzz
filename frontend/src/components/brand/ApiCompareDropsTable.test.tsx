/* eslint-disable testing-library/no-container -- The repo harness uses native DOM; Testing Library is not installed. */
import { act } from "react";
import type { BrandDropItem } from "../../api/hooks/useBrandHooks";
import { renderWithProviders } from "../../testUtils";
import ApiCompareDropsTable from "./ApiCompareDropsTable";

const metrics: [string, number, number, number][] = [
  ["First", 2, 100, 20],
  ["Second", 10, 3, 100],
  ["Third", 0, 0, 0],
];
const drops: BrandDropItem[] = metrics.map(([title, totalPosts, totalEngagement, totalReach]) => ({
  id: title, title, totalPosts, totalEngagement, totalReach,
  brandId: "brand-1", brandName: "Test Brand", description: "Test drop",
  image: "", location: "Test Campus", stage: "live",
  applyOpenAt: 0, applyCloseAt: 1, createdAt: 0, capacityTotal: 1,
  campaignHashtag: null, totalProductUnits: null, totalLikes: 0, totalComments: 0,
}));

it.each([
  ["Posts", "descending", ["Second", "First", "Third"], "ascending", ["Third", "First", "Second"]],
  ["Engagement", "ascending", ["Third", "Second", "First"], "descending", ["First", "Second", "Third"]],
  ["Reach", "descending", ["Second", "First", "Third"], "ascending", ["Third", "First", "Second"]],
])("sorts %s numerically and toggles direction", (label, firstDirection, firstOrder, secondDirection, secondOrder) => {
  const { container } = renderWithProviders(<ApiCompareDropsTable drops={drops} />);
  const rowTitles = () => Array.from(container.querySelectorAll("tbody a"), (link) => link.textContent);
  expect(rowTitles()).toEqual(["First", "Second", "Third"]);
  const button = Array.from(container.querySelectorAll("th button"))
    .find((element) => element.textContent === label) as HTMLButtonElement;
  button.focus();
  expect(document.activeElement).toBe(button);
  expect(button.type).toBe("button");

  act(() => button.click());
  expect(button.closest("th")?.getAttribute("aria-sort")).toBe(firstDirection);
  expect(rowTitles()).toEqual(firstOrder);
  expect(container.querySelectorAll('th[aria-sort="none"]')).toHaveLength(2);
  act(() => button.click());
  expect(button.closest("th")?.getAttribute("aria-sort")).toBe(secondDirection);
  expect(rowTitles()).toEqual(secondOrder);
});

it("starts a newly selected metric descending", () => {
  const { container } = renderWithProviders(<ApiCompareDropsTable drops={drops} />);
  const [posts, engagement, reach] = Array.from(container.querySelectorAll("th button")) as HTMLButtonElement[];
  act(() => posts.click());
  act(() => posts.click());
  act(() => reach.click());
  expect(reach.closest("th")?.getAttribute("aria-sort")).toBe("descending");
  expect(posts.closest("th")?.getAttribute("aria-sort")).toBe("none");
  expect(engagement.closest("th")?.getAttribute("aria-sort")).toBe("none");
});
