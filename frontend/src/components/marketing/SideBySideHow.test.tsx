/* eslint-disable testing-library/no-container -- The repository harness uses React DOM; Testing Library is not installed. */
import { renderWithProviders } from "../../testUtils";
import { SideBySideHow } from "./SideBySideHow";

beforeAll(() => {
  window.HTMLMediaElement.prototype.play = jest.fn().mockImplementation(() => Promise.resolve());
  window.HTMLMediaElement.prototype.pause = jest.fn();
});

describe("SideBySideHow", () => {
  it("renders 3 laptop mockups with video sources for student organizations", () => {
    const { container } = renderWithProviders(<SideBySideHow kind="org" />);
    expect(container.querySelector("h2")?.textContent).toBe("Partner with brands");

    const steps = container.querySelectorAll("ol > li");
    expect(steps).toHaveLength(3);

    expect(steps[0].querySelector("h3")?.textContent).toContain("Create your student organization’s profile");
    expect(steps[1].querySelector("h3")?.textContent).toContain("Discover new brand campaigns as they drop");
    expect(steps[2].querySelector("h3")?.textContent).toContain("Apply to collaborate with your favorite brands");

    const videos = container.querySelectorAll("video");
    expect(videos).toHaveLength(3);

    const firstVideoSources = Array.from(videos[0].querySelectorAll("source")).map((s) => s.src);
    expect(firstVideoSources.some((src) => src.includes("org-step1-apply.mp4"))).toBe(true);
  });

  it("renders 3 laptop mockups with video sources for brand portal", () => {
    const { container } = renderWithProviders(<SideBySideHow kind="brand" />);
    expect(container.querySelector("h2")?.textContent).toBe("Execute your campus activations");

    const steps = container.querySelectorAll("ol > li");
    expect(steps).toHaveLength(3);

    expect(steps[0].querySelector("h3")?.textContent).toContain("Tell us about your campaign");
    expect(steps[1].querySelector("h3")?.textContent).toContain("Choose the organizations");
    expect(steps[2].querySelector("h3")?.textContent).toContain("Follow every post & metric");

    const videos = container.querySelectorAll("video");
    expect(videos).toHaveLength(3);

    const firstVideoSources = Array.from(videos[0].querySelectorAll("source")).map((s) => s.src);
    expect(firstVideoSources.some((src) => src.includes("brand-step1-campaign.mp4"))).toBe(true);
  });
});
