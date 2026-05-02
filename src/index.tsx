/**
 * Application entry: mounts the SPA under `#root` with client-side routing.
 */
import "./index.css";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error('Root element with id "root" not found');
}

const root = ReactDOM.createRoot(rootEl);

root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
