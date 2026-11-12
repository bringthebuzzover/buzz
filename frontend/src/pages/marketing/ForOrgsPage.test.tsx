/* eslint-disable testing-library/no-container -- The shared harness uses React DOM; Testing Library is not installed. */
/**
 * /for-orgs tour: apply-first copy, Instagram after approval, apply CTA.
 */
import { act } from "react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../../testUtils";

import ForOrgsPage from "./ForOrgsPage";

describe("ForOrgsPage", () => {
  it("shows Business or Creator, Instagram after approval, and apply CTA", () => {
    const { container } = renderWithProviders(<ForOrgsPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/Business or Creator/);
    expect(text).not.toMatch(/Confirm this is our organization's account/);
    expect(text).not.toMatch(/confirm card/i);
    expect(text).toMatch(/Connect Instagram/);
    expect(text).not.toMatch(/placehold\.co/i);
    const hero = container.querySelector('img[alt="Kappa Alpha Theta x Yerba Madre"]');
    expect(hero).not.toBeNull();
    expect(text).not.toMatch(/Multiple Campuses/);

    const apply = container.querySelector('a[href="/org/apply"]');
    expect(apply?.textContent).toMatch(/apply as an organization|join us|join as a student organization/i);
    const login = container.querySelector('a[href="/login"]');
    expect(login).not.toBeNull();
    const joinHeading = Array.from(container.querySelectorAll("h2")).find((heading) =>
      heading.textContent?.includes("Apply with your"),
    );
    expect(joinHeading?.closest("section")?.textContent).not.toContain("Request a campaign");
    expect(container.querySelectorAll("footer")).toHaveLength(1);
  });

  it("presents three numbered portal steps with their captions", () => {
    const { container } = renderWithProviders(<ForOrgsPage />);
    const steps = container.querySelectorAll("#how-it-works ol > li");
    expect(steps).toHaveLength(3);
    expect(Array.from(steps, (step) => step.querySelector("h3")?.textContent)).toEqual([
      "1 Create your student organization’s profile",
      "2 Discover new brand campaigns as they drop",
      "3 Apply to collaborate with your favorite brands",
    ]);
    expect(Array.from(steps, (step) => step.querySelector("h3 + p")?.textContent)).toEqual([
      "Apply with your campus .edu email and verify your student organization profile.",
      "Browse active drops tailored for your campus and see what products are available.",
      "Submit your pitch in one click and follow campaign status in My Campaigns.",
    ]);
  });
  it("keeps the partner section before the approved tour and current drops", () => {
    const { container } = renderWithProviders(<ForOrgsPage />);
    expect(Array.from(container.querySelectorAll("h2"), (heading) => heading.textContent).slice(0, 3)).toEqual([
      "Partner with brands", "Current drops", "Questions",
    ]);
  });

  it.each([
    ["Join Us!", "/org/apply"],
    ["Already connected? Log in", "/login"],
  ])("routes %s to %s", (label, destination) => {
    const { container } = renderWithProviders(<Routes>
      <Route path="/" element={<ForOrgsPage />} />
      <Route path={destination} element={<p>Destination page</p>} />
    </Routes>);
    const link = Array.from(container.querySelectorAll("a")).find((item) => item.textContent === label);
    act(() => link?.click());
    expect(container.textContent).toBe("Destination page");
  });

});
