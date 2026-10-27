// BUZZ Lab login gate for Cloudflare Pages Functions.
//
// On by default: LAB_AUTH unset or empty fails closed on any non-localhost
// host; only an explicit LAB_AUTH=0/false/off/no turns it off (localhost
// keeps unset = off for local dev). When on, every request needs a signed session
// cookie, except the /__lab/* login routes and their assets. Missing secrets
// fail closed. Stateless: the pending code lives in a signed cookie (only an
// HMAC of the code, never the code itself). Rate limits and the per-code
// attempt counter use the Workers Cache API as a best-effort, per-colo store;
// the signed cookie also carries its own attempt count.
// See docs/LAB.md → "Lab login".

import { hmacHex, randomCode, randomId, signToken, timingSafeEqual, verifyToken } from "./crypto.mjs";
import { DEFAULT_FROM, sendCodeEmail } from "./email.mjs";
import {
  codePage,
  loginPage,
  misconfiguredPage,
  notFoundPage,
  signOutPage,
  signedOutPage,
} from "./pages.mjs";

// __Host- prefix: browsers only accept it with Secure, Path=/ and no Domain.
export const SESSION_COOKIE = "__Host-lab_session";
export const CHALLENGE_COOKIE = "lab_challenge";
export const SESSION_TTL = 24 * 60 * 60;
export const CODE_TTL = 10 * 60;
export const MAX_ATTEMPTS = 5;
export const MIN_SECRET_LENGTH = 32;

export const LIMITS = {
  sendPerIp: { limit: 10, window: 10 * 60 },
  sendPerEmail: { limit: 3, window: 10 * 60 },
  verifyPerIp: { limit: 30, window: 10 * 60 },
};

const ON = new Set(["1", "true", "yes", "on"]);
const OFF = new Set(["0", "false", "no", "off"]);
// The only files served from /__lab/assets/ (see scripts/copy-lab-login-assets.mjs).
export const LOGIN_ASSETS = new Set(["switzer-400.woff2", "switzer-500.woff2", "buzz-logo.svg", "bee.svg"]);
const FROM_DOMAIN = "bringthebuzzover.com";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

// ---------- config ----------

export function readConfig(env = {}, hostname = "") {
  const raw = String(env.LAB_AUTH ?? "").trim().toLowerCase();
  if (OFF.has(raw)) return { enabled: false };
  // Unset/empty: off only for local dev; everywhere else the gate stays on.
  if (raw === "" && LOCAL_HOSTS.has(String(hostname).toLowerCase())) return { enabled: false };
  if (raw !== "" && !ON.has(raw)) return { enabled: true, missing: ["LAB_AUTH (use 1)"] };
  const missing = [];
  const secret = String(env.LAB_SESSION_SECRET ?? "");
  if (secret.length < MIN_SECRET_LENGTH) missing.push(`LAB_SESSION_SECRET (${MIN_SECRET_LENGTH}+ chars)`);
  const allowed = parseAllowlist(env.LAB_ALLOWED_EMAILS);
  if (allowed.size === 0) missing.push("LAB_ALLOWED_EMAILS");
  const resendKey = String(env.RESEND_API_KEY ?? "").trim();
  if (!resendKey) missing.push("RESEND_API_KEY");
  return {
    enabled: true,
    missing,
    secret,
    allowed,
    resendKey,
    from: validFrom(env.LAB_EMAIL_FROM) || DEFAULT_FROM,
    devLogCode: String(env.LAB_DEV_LOG_CODE ?? "") === "1",
  };
}

// LAB_EMAIL_FROM must be "addr@bringthebuzzover.com" or "Name <addr@bringthebuzzover.com>".
// Anything else is ignored so the default sender is used.
export function validFrom(value) {
  const v = String(value ?? "").trim();
  if (!v || v.length > 200 || /[\r\n]/.test(v)) return "";
  const m = v.match(/^(?:([^<>"]{1,80}?)\s*<([^\s<>@]+@[^\s<>@]+)>|([^\s<>@]+@[^\s<>@]+))$/);
  if (!m) return "";
  const addr = (m[2] || m[3]).toLowerCase();
  if (!/^[a-z0-9._%+-]+@bringthebuzzover\.com$/.test(addr)) return "";
  return v;
}

export function parseAllowlist(value) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter((e) => e && e.includes("@")),
  );
}

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function looksLikeEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ---------- helpers ----------

export function safeNext(value) {
  const v = String(value ?? "");
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\\]/.test(v)) return "/";
  if (v.startsWith("/__lab/")) return "/";
  return v.length > 2048 ? "/" : v;
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k && !(k in out)) out[k] = part.slice(i + 1).trim();
  }
  return out;
}

function cookie(name, value, { maxAge, path = "/" }) {
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

const SECURITY_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

function html(body, status = 200, extra = {}) {
  const headers = new Headers({ "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS });
  for (const [k, v] of Object.entries(extra)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else headers.set(k, v);
  }
  return new Response(body, { status, headers });
}

function redirect(location, status = 303, cookies = []) {
  const headers = new Headers({ Location: location, ...SECURITY_HEADERS });
  cookies.forEach((c) => headers.append("Set-Cookie", c));
  return new Response(null, { status, headers });
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

// CSRF check for the login forms. Browsers send Origin on POST; a missing
// header (old clients, curl) falls back to Sec-Fetch-Site when present.
function sameOrigin(request, url) {
  const origin = request.headers.get("Origin");
  const site = request.headers.get("Sec-Fetch-Site");
  if (origin && origin !== "null") return origin === url.origin;
  if (site) return site === "same-origin" || site === "none";
  return origin !== "null";
}

async function readForm(request) {
  const type = request.headers.get("Content-Type") || "";
  if (!type.includes("application/x-www-form-urlencoded") && !type.includes("multipart/form-data")) {
    return new Map();
  }
  try {
    const form = await request.formData();
    return new Map([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  } catch {
    return new Map();
  }
}

// ---------- best-effort counters (Workers Cache API) ----------

function counterStore() {
  return globalThis.caches?.default ?? null;
}

async function counterKey(cfg, origin, bucket, id) {
  // Hash ids so emails/IPs never appear in cache keys.
  const h = await hmacHex(cfg.secret, `rl|${bucket}|${id}`);
  return new Request(`${origin}/__lab/_counter/${bucket}/${h}`);
}

export async function bump(cfg, origin, bucket, id, window) {
  const store = counterStore();
  if (!store) return 1;
  try {
    const key = await counterKey(cfg, origin, bucket, id);
    const now = Math.floor(Date.now() / 1000);
    let state = { c: 0, reset: now + window };
    const hit = await store.match(key);
    if (hit) {
      const prev = await hit.json().catch(() => null);
      if (prev && prev.reset > now) state = prev;
    }
    state.c += 1;
    await store.put(
      key,
      new Response(JSON.stringify(state), {
        headers: { "Cache-Control": `max-age=${Math.max(1, state.reset - now)}` },
      }),
    );
    return state.c;
  } catch {
    return 1;
  }
}

async function peek(cfg, origin, bucket, id) {
  const store = counterStore();
  if (!store) return 0;
  try {
    const hit = await store.match(await counterKey(cfg, origin, bucket, id));
    if (!hit) return 0;
    const state = await hit.json().catch(() => null);
    return state && state.reset > Date.now() / 1000 ? state.c : 0;
  } catch {
    return 0;
  }
}

// ---------- session ----------

export async function readSession(cfg, request) {
  const token = parseCookies(request.headers.get("Cookie"))[SESSION_COOKIE];
  if (!token) return null;
  const payload = await verifyToken(cfg.secret, "session", token);
  if (!payload || typeof payload.e !== "string" || typeof payload.exp !== "number") return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  // Removing an address from LAB_ALLOWED_EMAILS ends its sessions.
  if (!cfg.allowed.has(payload.e)) return null;
  return payload;
}

async function newSessionCookie(cfg, email) {
  const now = Math.floor(Date.now() / 1000);
  const token = await signToken(cfg.secret, "session", { e: email, iat: now, exp: now + SESSION_TTL });
  return cookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL });
}

const clearSession = () => cookie(SESSION_COOKIE, "", { maxAge: 0 });
const clearChallenge = () => cookie(CHALLENGE_COOKIE, "", { maxAge: 0, path: "/__lab" });

// ---------- challenge ----------

async function codeMac(cfg, nonce, email, code) {
  return hmacHex(cfg.secret, `code|${nonce}|${email}|${code}`);
}

async function challengeCookie(cfg, payload) {
  const token = await signToken(cfg.secret, "challenge", payload);
  const maxAge = Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
  return cookie(CHALLENGE_COOKIE, token, { maxAge, path: "/__lab" });
}

async function readChallenge(cfg, request) {
  const token = parseCookies(request.headers.get("Cookie"))[CHALLENGE_COOKIE];
  if (!token) return null;
  const p = await verifyToken(cfg.secret, "challenge", token);
  if (!p || typeof p.e !== "string" || typeof p.n !== "string" || typeof p.h !== "string") return null;
  if (typeof p.exp !== "number" || p.exp <= Math.floor(Date.now() / 1000)) return null;
  if (typeof p.a !== "number") return null;
  return p;
}

// ---------- routes ----------

async function postLogin(ctx, cfg, url) {
  const { request } = ctx;
  const form = await readForm(request);
  const next = safeNext(form.get("next"));
  const email = normalizeEmail(form.get("email"));
  if (!looksLikeEmail(email)) {
    return html(loginPage({ next, email, message: "Enter a valid email address.", kind: "error" }), 400);
  }
  const ip = clientIp(request);
  const ipCount = await bump(cfg, url.origin, "send-ip", ip, LIMITS.sendPerIp.window);
  const emailCount = await bump(cfg, url.origin, "send-email", email, LIMITS.sendPerEmail.window);
  if (ipCount > LIMITS.sendPerIp.limit || emailCount > LIMITS.sendPerEmail.limit) {
    return html(
      loginPage({ next, email, message: "Too many code requests. Wait a few minutes and try again.", kind: "error" }),
      429,
      { "Retry-After": "600" },
    );
  }

  const nonce = randomId();
  const exp = Math.floor(Date.now() / 1000) + CODE_TTL;
  let h;
  if (cfg.allowed.has(email)) {
    const code = randomCode();
    h = await codeMac(cfg, nonce, email, code);
    const local = LOCAL_HOSTS.has(url.hostname);
    if (cfg.devLogCode && local) {
      console.log(`[lab-auth] dev code for ${email}: ${code}`);
    } else {
      if (cfg.devLogCode) console.warn("[lab-auth] LAB_DEV_LOG_CODE ignored: not a localhost request.");
      // Send after the response (waitUntil), so allowed and decoy requests
      // answer in the same time and the allowlist can't be probed by timing.
      const sending = Promise.resolve()
        .then(() => sendCodeEmail({ apiKey: cfg.resendKey, from: cfg.from, to: email, code, fetchImpl: fetch }))
        .catch((err) => console.error(`[lab-auth] code email failed: ${err && err.message}`));
      if (typeof ctx.waitUntil === "function") ctx.waitUntil(sending);
    }
  } else {
    // Decoy: a challenge no code can satisfy. Same cookie, same page.
    h = await hmacHex(cfg.secret, `decoy|${randomId()}`);
  }
  const set = await challengeCookie(cfg, { e: email, n: nonce, h, exp, a: 0 });
  return redirect(`/__lab/verify?next=${encodeURIComponent(next)}`, 303, [set]);
}

async function getVerify(cfg, request, url) {
  const next = safeNext(url.searchParams.get("next"));
  const ch = await readChallenge(cfg, request);
  if (!ch) return redirect(`/__lab/login?next=${encodeURIComponent(next)}`, 303, [clearChallenge()]);
  return html(codePage({ next, email: ch.e }));
}

async function postVerify(ctx, cfg, url) {
  const { request } = ctx;
  const form = await readForm(request);
  const next = safeNext(form.get("next"));
  const ch = await readChallenge(cfg, request);
  const backToLogin = (message) =>
    html(loginPage({ next, email: ch ? ch.e : "", message, kind: "error" }), 400, {
      "Set-Cookie": clearChallenge(),
    });
  if (!ch) return backToLogin("That code expired. Request a new one.");

  const ip = clientIp(request);
  if ((await bump(cfg, url.origin, "verify-ip", ip, LIMITS.verifyPerIp.window)) > LIMITS.verifyPerIp.limit) {
    return html(codePage({ next, email: ch.e, message: "Too many tries. Wait a few minutes.", kind: "error" }), 429, {
      "Retry-After": "600",
    });
  }
  if ((await peek(cfg, url.origin, "used", ch.n)) > 0) return backToLogin("That code was already used. Request a new one.");

  // Attempts: the larger of the cookie's own count and the server-side count,
  // so replaying an older cookie does not reset the budget on this colo.
  const serverCount = await bump(cfg, url.origin, "attempts", ch.n, CODE_TTL);
  const attempt = Math.max(ch.a + 1, serverCount);
  if (attempt > MAX_ATTEMPTS) return backToLogin("Too many wrong codes. Request a new one.");

  const code = String(form.get("code") ?? "").replace(/\s+/g, "");
  const candidate = await codeMac(cfg, ch.n, ch.e, /^[0-9]{6}$/.test(code) ? code : "x");
  const ok = timingSafeEqual(candidate, ch.h) && /^[0-9]{6}$/.test(code) && cfg.allowed.has(ch.e);
  if (!ok) {
    const left = MAX_ATTEMPTS - attempt;
    if (left <= 0) return backToLogin("Too many wrong codes. Request a new one.");
    const set = await challengeCookie(cfg, { ...ch, a: attempt });
    return html(
      codePage({
        next,
        email: ch.e,
        message: `That code didn't work. ${left} ${left === 1 ? "try" : "tries"} left.`,
        kind: "error",
      }),
      400,
      { "Set-Cookie": set },
    );
  }

  await bump(cfg, url.origin, "used", ch.n, CODE_TTL);
  return redirect(next, 303, [await newSessionCookie(cfg, ch.e), clearChallenge()]);
}

async function handleLabRoute(ctx, cfg, url) {
  const { request } = ctx;
  const method = request.method.toUpperCase();
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (method === "POST" && !sameOrigin(request, url)) {
    return html(notFoundPage(), 403);
  }

  if (path === "/__lab/login") {
    if (method === "GET" || method === "HEAD") {
      const next = safeNext(url.searchParams.get("next"));
      if (await readSession(cfg, request)) return redirect(next, 303);
      return html(loginPage({ next }));
    }
    if (method === "POST") return postLogin(ctx, cfg, url);
  }
  if (path === "/__lab/verify") {
    if (method === "GET" || method === "HEAD") return getVerify(cfg, request, url);
    if (method === "POST") return postVerify(ctx, cfg, url);
  }
  if (path === "/__lab/logout") {
    // GET only shows a button; signing out is a same-origin POST (checked above).
    if (method === "GET" || method === "HEAD") return html(signOutPage());
    if (method === "POST") {
      return html(signedOutPage(), 200, { "Set-Cookie": [clearSession(), clearChallenge()] });
    }
    return html(notFoundPage(), 405, { Allow: "GET, POST" });
  }
  return html(notFoundPage(), 404);
}

function withNoindex(response) {
  const res = new Response(response.body, response);
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

/** Pages Functions entry (used by functions/_middleware.js). */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const cfg = readConfig(context.env, url.hostname);
  if (!cfg.enabled) return context.next();

  if (cfg.missing.length) {
    console.error(`[lab-auth] LAB_AUTH is on but missing: ${cfg.missing.join(", ")}`);
    return html(misconfiguredPage(cfg.missing), 503, { "Retry-After": "300" });
  }

  const path = url.pathname;

  // The 4 login assets (fonts, logos) are public; nothing else under /__lab is.
  if (path.startsWith("/__lab/assets/")) {
    const name = path.slice("/__lab/assets/".length);
    if (!LOGIN_ASSETS.has(name)) return html(notFoundPage(), 404);
    return withNoindex(await context.next());
  }
  if (path === "/__lab" || path.startsWith("/__lab/")) {
    return handleLabRoute(context, cfg, url);
  }
  if (path === "/robots.txt") {
    return withNoindex(await context.next());
  }

  if (await readSession(cfg, context.request)) {
    return withNoindex(await context.next());
  }

  const method = context.request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    const next = safeNext(path + url.search);
    return redirect(`/__lab/login?next=${encodeURIComponent(next)}`, 302, []);
  }
  return new Response("Sign in at /__lab/login", {
    status: 401,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS },
  });
}
