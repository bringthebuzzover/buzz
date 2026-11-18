/**
 * Shared Jest render harness.
 *
 * `renderWithProviders(ui)` mounts `ui` inside a MemoryRouter and a fresh
 * retry-off QueryClient, wrapped in act(). Every mount is unmounted after each
 * test (the afterEach below registers in every file that imports this), so
 * tests need no beforeEach/afterEach boilerplate.
 */
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, type InitialEntry } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export type RenderOptions = {
  /** Starting URL (or location with state). Default "/". */
  route?: InitialEntry;
  /** Route pattern to mount `ui` at, so `useParams` resolves. */
  path?: string;
  /** Set false when `ui` brings its own router. */
  router?: boolean;
};

export type Rendered = {
  container: HTMLDivElement;
  rerender: (ui: ReactElement) => void;
  unmount: () => void;
};

const mounted = new Set<() => void>();

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", path, router = true }: RenderOptions = {},
): Rendered {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (node: ReactElement) => {
    const routed = path ? (
      <Routes>
        <Route path={path} element={node} />
      </Routes>
    ) : (
      node
    );
    const tree = <QueryClientProvider client={queryClient}>{routed}</QueryClientProvider>;
    return router ? <MemoryRouter initialEntries={[route]}>{tree}</MemoryRouter> : tree;
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(wrap(ui)));

  const unmount = () => {
    if (!mounted.delete(unmount)) return;
    act(() => root.unmount());
    container.remove();
  };
  mounted.add(unmount);
  return { container, rerender: (next) => act(() => root.render(wrap(next))), unmount };
}

/** Let already-resolved promises (mocked fetches, mutations) settle inside act(). */
export async function flushPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function cleanup(): void {
  Array.from(mounted).forEach((unmount) => unmount());
}

afterEach(cleanup);
