/**
 * `/pulse2` keeps live-site copy and adds the logo, bee, map, and drops.
 * renderToString skips effects, so jsdom's media/scroll stubs stay quiet.
 */
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PulseTwoLayout from "../../layouts/PulseTwoLayout";
import PulseTwoHomePage from "./PulseTwoHomePage";

describe("PulseTwoHomePage", () => {
  it("renders the bottom-left hero, brand marks, campuses, and real drops", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/pulse2"]}>
        <Routes>
          <Route element={<PulseTwoLayout />}>
            <Route path="pulse2" element={<PulseTwoHomePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(html).toMatch(/Campus marketing,/);
    expect(html).toMatch(/powered by/);
    expect(html).toMatch(/student communities/);
    expect(html).toMatch(/large-scale campus activations nationwide/);
    expect(html).toMatch(/How it works/);
    expect(html).toMatch(/College network/);
    expect(html).toMatch(/Current drops/);
    expect(html).toMatch(/Yerba Madre/);
    expect(html).toMatch(/UPDATE/);
    expect(html).toMatch(/View drop/);
    expect(html).toMatch(/Apply as an organization/);
    expect(html).toMatch(/Apply as a brand/);
    expect(html).toMatch(/For organizations/);
    expect(html).toMatch(/For brands/);
    expect(html).toContain("logo.clearbit.com/stanford.edu");
    expect(html).toMatch(/Stanford/);
    expect(html).toMatch(/Princeton/);
    expect(html).toMatch(/School \(\.edu\) email/);
    expect(html).toMatch(/Connect with Instagram/);
    expect(html).toMatch(/Instagram Reach/);
    expect(html).toMatch(/hello@bringthebuzzover.com/);
    expect(html).toContain('href="/org/apply"');
    expect(html).toContain('href="/brand/apply"');
    expect(html).toContain('href="/for-orgs"');
    expect(html).toContain('href="/for-brands"');
    expect(html).toContain('href="/pulse2"');
    expect(html).toContain("buzz-logo.svg");
    expect(html).toContain("bee.svg");
    expect(html).toContain("hero.mp4");
    expect(html).toContain("hero-h264.mp4");
    expect(html).not.toMatch(/buzz-coral|buzz-cream|buzz-butter/);
    expect(html).not.toMatch(/Campus Kickoff/);
  });
});