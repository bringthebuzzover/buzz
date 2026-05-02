/**
 * Application entry: mounts the SPA under `#root` with client-side routing (`AppRoot` = routes).
 */
import "./index.css";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AccessGateProvider } from "./contexts/AccessGateContext";
import PasscodeModal from "./components/site/modals/PasscodeModal";
import AppRoot from "./AppRoot";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error('Root element with id "root" not found');
}

const root = ReactDOM.createRoot(rootEl);

root.render(
  <BrowserRouter>
    <AccessGateProvider>
      <AppRoot />
      <PasscodeModal />
    </AccessGateProvider>
  </BrowserRouter>,
);
