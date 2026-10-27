// Small Web Crypto helpers for the Lab login. Runs in Cloudflare Pages
// Functions and in Node 20+ (tests). No dependencies.

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlEncode(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(str) {
  if (typeof str !== "string" || !/^[A-Za-z0-9_-]*$/.test(str)) return null;
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  try {
    const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

const keyCache = new Map();

async function hmacKey(secret) {
  let key = keyCache.get(secret);
  if (!key) {
    key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    keyCache.set(secret, key);
  }
  return key;
}

export async function hmac(secret, message) {
  const key = await hmacKey(secret);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

export async function hmacHex(secret, message) {
  const bytes = await hmac(secret, message);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two byte arrays or two strings. */
export function timingSafeEqual(a, b) {
  const x = typeof a === "string" ? enc.encode(a) : a;
  const y = typeof b === "string" ? enc.encode(b) : b;
  // Always walks all of `x`; a length mismatch still fails.
  let diff = x.length ^ y.length;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ (i < y.length ? y[i] : 0);
  return diff === 0;
}

/** Uniform random 6-digit code, zero-padded. */
export function randomCode() {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return String(buf[0] % 1_000_000).padStart(6, "0");
  }
}

export function randomId(bytes = 16) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return b64urlEncode(buf);
}

/**
 * Signed token: v1.<payload>.<mac>. `purpose` is mixed into the MAC so a
 * challenge token can never be replayed as a session token.
 */
export async function signToken(secret, purpose, payload) {
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const mac = b64urlEncode(await hmac(secret, `${purpose}|v1.${body}`));
  return `v1.${body}.${mac}`;
}

export async function verifyToken(secret, purpose, token) {
  if (typeof token !== "string" || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const expected = await hmac(secret, `${purpose}|v1.${parts[1]}`);
  const given = b64urlDecode(parts[2]);
  if (!given || !timingSafeEqual(expected, given)) return null;
  const raw = b64urlDecode(parts[1]);
  if (!raw) return null;
  try {
    const payload = JSON.parse(dec.decode(raw));
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}
