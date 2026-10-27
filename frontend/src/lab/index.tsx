/**
 * Entry for the lab build only. `craco.config.js` selects this when
 * `VITE_LAB=1`. Production stays on `src/index.tsx`.
 */
import "../index.css";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../contexts/AuthContext";
import LabShell from "./LabShell";

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LabShell />
      </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>,
);
