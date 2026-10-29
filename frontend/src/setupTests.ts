/**
 * Jest setup (auto-loaded by CRA before each test module).
 *
 * jsdom in this CRA/jest version doesn't define TextEncoder/TextDecoder, but
 * react-router v7 instantiates TextEncoder at module load. Polyfill from
 * node's `util` so importing the router in tests doesn't throw.
 */
import { TextEncoder, TextDecoder } from "util";

const g = global as unknown as {
  TextEncoder?: typeof TextEncoder;
  TextDecoder?: typeof TextDecoder;
};
if (!g.TextEncoder) g.TextEncoder = TextEncoder;
if (!g.TextDecoder) g.TextDecoder = TextDecoder;

// React 18+: tell React this is a test env so act() works without warnings.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// renderToString tests render components that use useLayoutEffect (Radix,
// react-router links); React warns that it is a no-op on the server. Expected
// in SSR tests, so drop just that warning.
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("useLayoutEffect does nothing on the server")) {
    return;
  }
  consoleError(...args);
};
