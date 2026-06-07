/**
 * Smoke render tests for the `USE_API` provider tree.
 *
 * The `REACT_APP_USE_API=true` entry tree (index.tsx) deliberately omits the
 * demo providers (AccessGateProvider, DemoClockProvider). Shared chrome and
 * card components still call `useAccessGate()` / `useDemoNow()`, which used to
 * THROW without a provider — white-screening every route. These tests render
 * the shell and a feed card *without* the demo providers and assert they don't
 * throw, so that regression can't silently come back.
 *
 * We use `react-dom/server`'s `renderToString` (no extra test deps): it throws
 * if a component throws during render, which is exactly the crash class here.
 * Effects don't run under SSR, so AuthProvider issues no network calls.
 */
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAccessGate } from "./contexts/AccessGateContext";
import { useDemoNow } from "./contexts/DemoClockContext";
import { AuthProvider } from "./contexts/AuthContext";
import AppRoot from "./AppRoot";
import DropFeedCard from "./components/org/DropFeedCard";
import type { DropCardData } from "./types/drop";

function HookProbe() {
  const gate = useAccessGate();
  const now = useDemoNow();
  // Single interpolated string so SSR doesn't split it with comment markers.
  return <div>{`gate=${gate.isDemoActive} now=${typeof now}`}</div>;
}

describe("USE_API provider-tree smoke", () => {
  it("demo-context hooks return inert fallbacks without their providers", () => {
    expect(renderToString(<HookProbe />)).toContain("gate=false now=number");
  });

  it("renders the marketing shell + home at / without demo providers", () => {
    const queryClient = new QueryClient();
    const render = () =>
      renderToString(
        <MemoryRouter initialEntries={["/"]}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRoot />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    expect(render).not.toThrow();
  });

  it("renders an org DropFeedCard without the demo clock provider", () => {
    const card: DropCardData = {
      id: "d1",
      brandName: "Acme",
      title: "Test Drop",
      description: "A test drop.",
      image: "https://example.test/img.png",
      location: "Test City",
      capacityTotal: 5,
      applyOpenAt: Date.now() - 1_000,
      applyCloseAt: Date.now() + 100_000,
      manualReopen: false,
    };
    const render = () =>
      renderToString(
        <MemoryRouter>
          <DropFeedCard
            drop={card}
            acceptedCount={0}
            feedStatus="open"
            alreadyApplied={false}
            onApply={() => {}}
          />
        </MemoryRouter>,
      );
    expect(render).not.toThrow();
  });
});
