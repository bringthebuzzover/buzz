/**
 * Application entry: mounts the SPA under `#root` with client-side routing (`AppRoot` = routes).
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

// AuthProvider is mounted only for the API slice; with USE_API off the demo
// tree is byte-for-byte what it was before Stage 4.
const tree = USE_API ? (
  <AuthProvider>
    <AppRoot />
  </AuthProvider>
) : (
  <AppRoot />
);

root.render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AccessGateProvider>
        <MockDataProvider>
          <DemoClockProvider>
            {tree}
            <PasscodeModal />
          </DemoClockProvider>
        </MockDataProvider>
      </AccessGateProvider>
    </QueryClientProvider>
  </BrowserRouter>,
);
