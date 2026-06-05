/**
 * Application entry: mounts the SPA under `#root` with client-side routing (`AppRoot` = routes).
 *
 * Stage 6: when USE_API is true, demo providers (AccessGateProvider, MockDataProvider,
 * DemoClockProvider, PasscodeModal) are elided and the real AuthProvider is mounted.
 * When false, the demo tree is byte-for-byte unchanged.
 */
import "./index.css";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccessGateProvider } from "./contexts/AccessGateContext";
import { MockDataProvider } from "./contexts/MockDataContext";
import { DemoClockProvider } from "./contexts/DemoClockContext";
import { AuthProvider } from "./contexts/AuthContext";
import PasscodeModal from "./components/site/modals/PasscodeModal";
import AppRoot from "./AppRoot";
import { USE_API } from "./config/featureFlags";

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

if (USE_API) {
  // API path: real auth, no demo providers.
  root.render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRoot />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>,
  );
} else {
  // Demo path: unchanged from Stage 4.
  root.render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AccessGateProvider>
          <MockDataProvider>
            <DemoClockProvider>
              <AppRoot />
              <PasscodeModal />
            </DemoClockProvider>
          </MockDataProvider>
        </AccessGateProvider>
      </QueryClientProvider>
    </BrowserRouter>,
  );
}
