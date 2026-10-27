/**
 * `/pulse` concept: live-site copy, real apply paths, no invented proof.
 * renderToString skips effects, so jsdom's media/scroll stubs stay quiet.
 */
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PulseLayout from "../../layouts/PulseLayout";
import PulseHomePage from "./PulseHomePage";

describe("PulseHomePage", () => {
  it("renders live copy, apply paths, and the college network", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/pulse"]}>
        <Routes>
          <Route element={<PulseLayout />}>
            <Route path="pulse" element={<PulseHomePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(html).toMatch(/Campus/);
    expect(html).toMatch(/marketing/);
    expect(html).toMatch(/powered by/);
    expect(html).toMatch(/student communities/);
    expect(html).toMatch(/Yerba Madre x Cornell University/);
    expect(html).toMatch(/Kappa Alpha Theta x Yerba Madre/);
    expect(html).toMatch(/Princeton/);
    expect(html).toMatch(/hello@bringthebuzzover.com/);
    expect(html).toMatch(/Business or Creator/);
    expect(html).toContain('href="/org/apply"');
    expect(html).toContain('href="/brand/apply"');
    expect(html).toContain('href="/for-orgs"');
    expect(html).toContain('href="/for-brands"');
    expect(html).toContain('href="/login"');
    expect(html).toContain("hero.mp4");
    expect(html).toContain("hero-h264.mp4");
    expect(html).not.toMatch(/buzz-coral|buzz-cream|buzz-butter/);
  });
});
