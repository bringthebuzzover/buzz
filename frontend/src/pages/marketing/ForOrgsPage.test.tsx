/* eslint-disable testing-library/no-container -- The shared harness uses React DOM; Testing Library is not installed. */
/**
 * /for-orgs tour: apply-first copy, Instagram after approval, apply CTA.
 */
import { renderWithProviders } from "../../testUtils";

import ForOrgsPage from "./ForOrgsPage";

describe("ForOrgsPage", () => {
  it("shows Business or Creator, Instagram after approval, and apply CTA", () => {
    const { container } = renderWithProviders(<ForOrgsPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/Business or Creator/);
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

  it("presents three numbered portal steps with their captions", () => {
    const { container } = renderWithProviders(<ForOrgsPage />);
    const steps = container.querySelectorAll("#how-it-works ol > li");
    expect(steps).toHaveLength(3);
    expect(Array.from(steps, (step) => step.querySelector("h3")?.textContent)).toEqual([
      "1 Apply with your .edu email",
      "2 Connect Instagram",
      "3 Apply to open drops",
    ]);
    expect(Array.from(steps, (step) => step.querySelector("h3 + p")?.textContent)).toEqual([
      "Tell BUZZ about your organization and campus.",
      "After approval, connect your Business or Creator account.",
      "Browse current drops and apply for your organization.",
    ]);
  });
});
