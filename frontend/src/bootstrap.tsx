/**
 * Router and React Query mount for the lab entry. No AuthProvider.
 * `src/index.tsx` stays the production entry and is not imported here.
 */
import type { ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function mountApp(children: ReactNode): void {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error('Root element with id "root" not found');
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    },
  });

  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </BrowserRouter>,
  );
}
