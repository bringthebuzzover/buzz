/**
 * Smoke render tests for the API provider tree.
 *
 * The entry tree (index.tsx) mounts the real `AuthProvider` and React Query.
 * These tests render the marketing shell and a feed card and assert they don't
 * throw — guarding the white-screen crash class.
 *
 * We use `react-dom/server`'s `renderToString` (no extra test deps): it throws
 * if a component throws during render. Effects don't run under SSR, so
 * AuthProvider issues no network calls.
 */
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import AppRoot from "./AppRoot";
import DropFeedCard from "./components/org/DropFeedCard";
import type { DropCardData } from "./types/drop";

describe("API provider-tree smoke", () => {
  it("renders the marketing shell + home at / without throwing", () => {
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

  it("renders an org DropFeedCard using the shared wall clock (no provider needed)", () => {
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
