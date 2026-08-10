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
