/**
 * /pulse-bee/orgs and /pulse-bee/brands, rendered through AppRoot so the
 * routes, the shared layout, and the nav overrides are all exercised.
 */
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppRoot from "../../AppRoot";

function render(path: string): string {
  return renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoot />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const PLACEHOLDERS = /\$\d|\d+ free|stipend|buzz-coral|buzz-cream|buzz-butter|Campus Kickoff/;

describe("Pulse Bee audience pages", () => {
  it("renders /pulse-bee/orgs", () => {
    const html = render("/pulse-bee/orgs");
    expect(html).toMatch(/Brand drops/);
    expect(html).toMatch(/Partner with brands/);
    expect(html).toMatch(/Apply with your campus \.edu email\./);
    expect(html).toMatch(/Current drops/);
    expect(html).toMatch(/Questions/);
    expect(html).toMatch(/Check Junk on campus Outlook/);
    expect(html).toContain('href="/org/apply"');
    expect(html).toContain('href="/pulse-bee/brands"');
    expect(html).toContain('href="/login"');
    expect(html).toContain("pulse2-footer");
    expect(html).not.toMatch(PLACEHOLDERS);
  });

  it("renders /pulse-bee/brands", () => {
    const html = render("/pulse-bee/brands");
    expect(html).toMatch(/Authentic college/);
    expect(html).toMatch(/Buzz mints and publishes the drop/);
    expect(html).toMatch(/What are you hoping/);
    expect(html).toMatch(/Run a campus activation/);
    expect(html).toMatch(/College network/);
    expect(html).toMatch(/Who handles logistics\?/);
    expect(html).toContain('href="/brand/apply"');
    expect(html).toContain('href="/brand/login"');
    expect(html).toContain('href="/pulse-bee/orgs"');
    expect(html).toContain('id="pulsebee-flight"');
    expect(html).not.toMatch(PLACEHOLDERS);
  });

  it("leaves /pulse-bee's own nav and dock alone", () => {
    const html = render("/pulse-bee");
    expect(html).toContain('href="#students"');
    expect(html).toContain('href="#brands"');
    expect(html).toMatch(/Join as a student organization/);
    expect(html).not.toContain('href="/pulse-bee/orgs"');
  });
});
