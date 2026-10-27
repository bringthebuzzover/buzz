// Unit tests for the Lab login gate. Run: npm run test:lab-auth (Node 20+).
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { onRequest, readConfig, safeNext, validFrom, MAX_ATTEMPTS, SESSION_TTL, CODE_TTL, SESSION_COOKIE, LOGIN_ASSETS } from "./handler.mjs";
import { signToken, timingSafeEqual, randomCode } from "./crypto.mjs";

const SECRET = "test-secret-0123456789-abcdefghijklmnop";
const ALLOWED = "hello@example.com";
const ENV = {
  LAB_AUTH: "1",
  LAB_SESSION_SECRET: SECRET,
  LAB_ALLOWED_EMAILS: ` ${ALLOWED.toUpperCase()} , other@example.com`,
  RESEND_API_KEY: "re_fake_key",
};
const ORIGIN = "https://lab.example.com";

// In-memory stand-in for caches.default.
class MemCache {
  constructor() { this.map = new Map(); }
  async match(req) { const v = this.map.get(req.url); return v ? new Response(v) : undefined; }
  async put(req, res) { this.map.set(req.url, await res.text()); }
}

let sent;
let realFetch;
beforeEach(() => {
  globalThis.caches = { default: new MemCache() };
  sent = [];
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    return new Response("{}", { status: 200 });
  };
});
afterEach(() => {
  delete globalThis.caches;
  globalThis.fetch = realFetch;
});

const LAB = { clone: () => new Response("LAB DIRECTORY", { headers: { "Content-Type": "text/html" } }) };
function call(path, { method = "GET", env = ENV, cookies = {}, form, ip = "203.0.113.9", origin = ORIGIN } = {}) {
  const headers = new Headers({ "CF-Connecting-IP": ip });
  const jar = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  if (jar) headers.set("Cookie", jar);
  let body;
  if (form) {
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    headers.set("Origin", origin);
    body = new URLSearchParams(form).toString();
  }
  if (method === "POST" && !headers.has("Origin")) headers.set("Origin", origin);
  const request = new Request(origin + path, { method, headers, body });
  let nextCalled = false;
  const pending = [];
  return onRequest({
    request,
    env,
    waitUntil: (p) => pending.push(p),
    next: async () => { nextCalled = true; return LAB.clone(); },
  })
    .then(async (res) => { await Promise.all(pending); return res; })
    .then((res) => Object.assign(res, { nextCalled, waited: pending.length }));
}

function setCookies(res) {
  const out = {};
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const i = pair.indexOf("=");
    out[pair.slice(0, i)] = { value: pair.slice(i + 1), line };
  }
  return out;
}

async function requestCode(email = ALLOWED, ip) {
  const res = await call("/__lab/login", { method: "POST", form: { email, next: "/pulse2" }, ip });
  return { res, challenge: setCookies(res).lab_challenge?.value };
}

test("explicit LAB_AUTH=0/false/off: middleware is a pass-through", async () => {
  for (const env of [{ LAB_AUTH: "0" }, { LAB_AUTH: "false" }, { LAB_AUTH: "off" }, { LAB_AUTH: " OFF " }]) {
    const res = await call("/", { env });
    assert.equal(res.nextCalled, true);
    assert.equal(await res.text(), "LAB DIRECTORY");
  }
});

test("LAB_AUTH unset or empty fails closed on any non-localhost host", async () => {
  for (const env of [{}, { LAB_AUTH: "" }, { LAB_AUTH: "  " }]) {
    for (const origin of [ORIGIN, "https://abc123.lab-buzz.pages.dev", "https://lab.bringthebuzzover.com"]) {
      const res = await call("/", { env, origin });
      assert.equal(res.status, 503, `${origin} ${JSON.stringify(env)}`);
      assert.equal(res.nextCalled, false);
    }
    // With the rest of the config present, unset LAB_AUTH still gates.
    const gated = await call("/pulse2", { env: { ...ENV, LAB_AUTH: env.LAB_AUTH } });
    assert.equal(gated.status, 302);
    assert.equal(gated.nextCalled, false);
  }
  // Local dev keeps unset = off.
  for (const origin of ["http://localhost:8788", "http://127.0.0.1:8788"]) {
    const res = await call("/", { env: {}, origin });
    assert.equal(res.nextCalled, true, origin);
  }
  assert.equal(readConfig({}, "lab.bringthebuzzover.com").enabled, true);
  assert.equal(readConfig({}, "localhost").enabled, false);
});

test("fails closed when LAB_AUTH=1 but secrets are missing", async () => {
  for (const env of [
    { LAB_AUTH: "1" },
    { ...ENV, LAB_SESSION_SECRET: "short" },
    { ...ENV, LAB_ALLOWED_EMAILS: " , " },
    { ...ENV, RESEND_API_KEY: "" },
    { ...ENV, LAB_AUTH: "maybe" },
  ]) {
    for (const path of ["/", "/__lab/login", "/__lab/assets/bee.svg", "/robots.txt"]) {
      const res = await call(path, { env });
      assert.equal(res.status, 503, `${path} ${JSON.stringify(Object.keys(env))}`);
      assert.equal(res.nextCalled, false);
    }
  }
  const body = await (await call("/", { env: { LAB_AUTH: "1" } })).text();
  assert.match(body, /LAB_SESSION_SECRET/);
  assert.doesNotMatch(body, /re_fake_key/);
});

test("unauthenticated GET redirects to login with next", async () => {
  const res = await call("/pulse2?x=1");
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), "/__lab/login?next=%2Fpulse2%3Fx%3D1");
  assert.equal(res.nextCalled, false);
  const post = await call("/api", { method: "POST" });
  assert.equal(post.status, 401);
});

test("login page and assets are public and noindex", async () => {
  const page = await call("/__lab/login");
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("X-Robots-Tag"), "noindex, nofollow");
  assert.match(await page.text(), /Send code/);
  for (const name of LOGIN_ASSETS) {
    const asset = await call(`/__lab/assets/${name}`);
    assert.equal(asset.nextCalled, true, name);
    assert.equal(asset.headers.get("X-Robots-Tag"), "noindex, nofollow");
  }
  assert.equal(LOGIN_ASSETS.size, 4);
});

test("only the 4 login assets are public under /__lab/assets/", async () => {
  for (const path of [
    "/__lab/assets/",
    "/__lab/assets/index.html",
    "/__lab/assets/app.js",
    "/__lab/assets/bee.svg/x",
    "/__lab/assets/../../index.html",
    "/__lab/assets/%2e%2e/index.html",
    "/__lab/assets/BEE.SVG",
  ]) {
    const res = await call(path);
    assert.equal(res.nextCalled, false, path);
    assert.ok(res.status === 404 || res.status === 302, `${path} -> ${res.status}`);
    assert.doesNotMatch(await res.text(), /LAB DIRECTORY/);
  }
});

test("allowlisted email gets a code by email; right code opens the Lab", async () => {
  const { res, challenge } = await requestCode("Hello@Example.com ");
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), "/__lab/verify?next=%2Fpulse2");
  assert.ok(challenge);
  assert.equal(res.waited, 1, "code email is sent via waitUntil");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, "https://api.resend.com/emails");
  assert.equal(sent[0].auth, "Bearer re_fake_key");
  assert.deepEqual(sent[0].body.to, [ALLOWED]);
  assert.equal(sent[0].body.from, "BUZZ Lab <lab@bringthebuzzover.com>");
  const code = sent[0].body.subject.match(/(\d{6})/)[1];
  assert.match(sent[0].body.html, new RegExp(code));
  assert.doesNotMatch(decodeURIComponent(challenge), new RegExp(code), "code is not stored in the cookie");

  const page = await call("/__lab/verify?next=%2Fpulse2", { cookies: { lab_challenge: challenge } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /is allowed, a code is on its way/);

  const ok = await call("/__lab/verify", { method: "POST", form: { code, next: "/pulse2" }, cookies: { lab_challenge: challenge } });
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get("Location"), "/pulse2");
  const jar = setCookies(ok);
  assert.ok(jar[SESSION_COOKIE].value);
  assert.equal(SESSION_COOKIE, "__Host-lab_session");
  assert.match(jar[SESSION_COOKIE].line, /Path=\/;/);
  assert.doesNotMatch(jar[SESSION_COOKIE].line, /Domain=/i);
  assert.match(jar[SESSION_COOKIE].line, /HttpOnly/);
  assert.match(jar[SESSION_COOKIE].line, /Secure/);
  assert.match(jar[SESSION_COOKIE].line, /SameSite=Lax/);
  assert.match(jar[SESSION_COOKIE].line, new RegExp(`Max-Age=${SESSION_TTL}`));
  assert.match(jar.lab_challenge.line, /Max-Age=0/);

  const lab = await call("/", { cookies: { [SESSION_COOKIE]: jar[SESSION_COOKIE].value } });
  assert.equal(lab.nextCalled, true);
  assert.equal(await lab.text(), "LAB DIRECTORY");
  assert.equal(lab.headers.get("X-Robots-Tag"), "noindex, nofollow");

  // The challenge cannot be reused after success.
  const again = await call("/__lab/verify", { method: "POST", form: { code }, cookies: { lab_challenge: challenge } });
  assert.equal(again.status, 400);
  assert.equal(setCookies(again)[SESSION_COOKIE], undefined);
});

test("non-allowlisted email: same response, no email sent, no code works", async () => {
  const a = await requestCode(ALLOWED, "198.51.100.1");
  const b = await requestCode("stranger@example.com", "198.51.100.2");
  assert.equal(sent.length, 1, "only the allowlisted address got mail");
  assert.equal(a.res.waited, 1);
  assert.equal(b.res.waited, 0);
  assert.equal(b.res.status, a.res.status);
  assert.equal(b.res.headers.get("Location"), a.res.headers.get("Location"));
  assert.ok(b.challenge);
  const page = await call("/__lab/verify", { cookies: { lab_challenge: b.challenge } });
  assert.match(await page.text(), /If <strong>stranger@example.com<\/strong> is allowed, a code is on its way/);
  for (const code of ["000000", "123456"]) {
    const res = await call("/__lab/verify", { method: "POST", form: { code }, cookies: { lab_challenge: b.challenge } });
    assert.equal(setCookies(res)[SESSION_COOKIE], undefined);
  }
});

test("wrong code fails and attempts are capped at 5", async () => {
  const { challenge } = await requestCode();
  const code = sent[0].body.subject.match(/(\d{6})/)[1];
  const wrong = code === "000000" ? "111111" : "000000";
  let cookie = challenge;
  for (let i = 1; i < MAX_ATTEMPTS; i++) {
    const res = await call("/__lab/verify", { method: "POST", form: { code: wrong }, cookies: { lab_challenge: cookie } });
    assert.equal(res.status, 400);
    assert.match(await res.text(), new RegExp(`${MAX_ATTEMPTS - i} tr(y|ies) left`));
    assert.equal(setCookies(res)[SESSION_COOKIE], undefined);
    cookie = setCookies(res).lab_challenge.value;
  }
  const last = await call("/__lab/verify", { method: "POST", form: { code: wrong }, cookies: { lab_challenge: cookie } });
  assert.match(await last.text(), /Too many wrong codes/);
  // Even the right code is refused now, including with the original cookie replayed.
  for (const c of [cookie, challenge]) {
    const res = await call("/__lab/verify", { method: "POST", form: { code }, cookies: { lab_challenge: c } });
    assert.equal(setCookies(res)[SESSION_COOKIE], undefined);
  }
});

test("expired code and expired session are rejected", async () => {
  const realNow = Date.now;
  try {
    const { challenge } = await requestCode();
    const code = sent[0].body.subject.match(/(\d{6})/)[1];
    Date.now = () => realNow() + (CODE_TTL + 1) * 1000;
    const res = await call("/__lab/verify", { method: "POST", form: { code }, cookies: { lab_challenge: challenge } });
    assert.match(await res.text(), /expired/);
    assert.equal(setCookies(res)[SESSION_COOKIE], undefined);
  } finally {
    Date.now = realNow;
  }
  const now = Math.floor(Date.now() / 1000);
  const stale = await signToken(SECRET, "session", { e: ALLOWED, iat: now - SESSION_TTL - 5, exp: now - 5 });
  const res = await call("/", { cookies: { [SESSION_COOKIE]: stale } });
  assert.equal(res.status, 302);
  const fresh = await signToken(SECRET, "session", { e: ALLOWED, iat: now, exp: now + 60 });
  assert.equal((await call("/", { cookies: { [SESSION_COOKIE]: fresh } })).nextCalled, true);
});

test("forged, cross-purpose and de-allowlisted sessions are rejected", async () => {
  const now = Math.floor(Date.now() / 1000);
  const wrongKey = await signToken("another-secret-0123456789-abcdefghijk", "session", { e: ALLOWED, exp: now + 60 });
  const wrongPurpose = await signToken(SECRET, "challenge", { e: ALLOWED, exp: now + 60 });
  const removed = await signToken(SECRET, "session", { e: "gone@example.com", exp: now + 60 });
  for (const token of [wrongKey, wrongPurpose, removed, "v1.e30.AAAA", "garbage"]) {
    const res = await call("/", { cookies: { [SESSION_COOKIE]: token } });
    assert.equal(res.status, 302);
    assert.equal(res.nextCalled, false);
  }
});

test("logout is POST-only and same-origin", async () => {
  const get = await call("/__lab/logout");
  assert.equal(get.status, 200);
  assert.equal(get.headers.getSetCookie().length, 0, "GET does not sign out");
  assert.match(await get.text(), /<form method="post" action="\/__lab\/logout">/);

  const out = await call("/__lab/logout", { method: "POST", form: {} });
  const evil = new Request(ORIGIN + "/__lab/logout", { method: "POST", headers: { Origin: "https://evil.example" } });
  const refused = await onRequest({ request: evil, env: ENV, next: async () => LAB.clone() });
  assert.equal(refused.status, 403);
  assert.equal(refused.headers.getSetCookie().length, 0);

  assert.equal(out.status, 200);
  const jar = setCookies(out);
  assert.match(jar[SESSION_COOKIE].line, /Max-Age=0/);
  assert.match(jar.lab_challenge.line, /Max-Age=0/);
  assert.match(await out.text(), /Signed out/);

  assert.equal((await call("/__lab/logout", { method: "PUT" })).status, 405);
});

test("per-email send rate limit", async () => {
  for (let i = 0; i < 3; i++) assert.equal((await requestCode(ALLOWED, `192.0.2.${i}`)).res.status, 303);
  const res = await call("/__lab/login", { method: "POST", form: { email: ALLOWED }, ip: "192.0.2.99" });
  assert.equal(res.status, 429);
  assert.equal(sent.length, 3);
});

test("dev log mode only works on localhost", async () => {
  const env = { ...ENV, LAB_DEV_LOG_CODE: "1" };
  const logs = [];
  const realLog = console.log;
  console.log = (...a) => logs.push(a.join(" "));
  try {
    await call("/__lab/login", { method: "POST", form: { email: ALLOWED }, env });
    assert.equal(sent.length, 1, "non-localhost still sends through Resend");
    const req = new Request("http://localhost:8788/__lab/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "CF-Connecting-IP": "127.0.0.1" },
      body: "email=" + encodeURIComponent(ALLOWED),
    });
    await onRequest({ request: req, env, next: async () => LAB.clone() });
    assert.equal(sent.length, 1, "localhost dev mode does not call Resend");
    assert.ok(logs.some((l) => /dev code for hello@example.com: \d{6}/.test(l)));
  } finally {
    console.log = realLog;
  }
});

test("cross-origin POST is refused", async () => {
  const req = new Request(ORIGIN + "/__lab/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: "https://evil.example" },
    body: "email=" + encodeURIComponent(ALLOWED),
  });
  const res = await onRequest({ request: req, env: ENV, next: async () => LAB.clone() });
  assert.equal(res.status, 403);
  assert.equal(sent.length, 0);
});

test("helpers", () => {
  assert.equal(safeNext("/pulse2?a=1"), "/pulse2?a=1");
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/__lab/logout", ""]) {
    assert.equal(safeNext(bad), "/");
  }
  assert.ok(timingSafeEqual("abc", "abc"));
  assert.ok(!timingSafeEqual("abc", "abd"));
  assert.ok(!timingSafeEqual("abc", "abcd"));
  assert.ok(!timingSafeEqual("", "a"));
  for (let i = 0; i < 200; i++) assert.match(randomCode(), /^\d{6}$/);
  assert.deepEqual([...readConfig(ENV).allowed], ["hello@example.com", "other@example.com"]);
  assert.equal(readConfig({}).enabled, true, "unset LAB_AUTH with no host is on");
});

test("LAB_EMAIL_FROM must be @bringthebuzzover.com, else the default is used", async () => {
  const DEFAULT = "BUZZ Lab <lab@bringthebuzzover.com>";
  for (const ok of ["lab@bringthebuzzover.com", "BUZZ Lab <team@bringthebuzzover.com>", "Lab<LAB@BringTheBuzzOver.com>"]) {
    assert.equal(readConfig({ ...ENV, LAB_EMAIL_FROM: ok }).from, ok, ok);
  }
  for (const bad of [
    "",
    "lab@example.com",
    "BUZZ <lab@bringthebuzzover.com.evil.example>",
    "lab@send.bringthebuzzover.com",
    "lab@evilbringthebuzzover.com",
    "x <a@bringthebuzzover.com>, y <b@example.com>",
    "BUZZ\r\nBcc: x@example.com <lab@bringthebuzzover.com>",
    "not an email",
  ]) {
    assert.equal(validFrom(bad), "", bad);
    assert.equal(readConfig({ ...ENV, LAB_EMAIL_FROM: bad }).from, DEFAULT, bad);
  }
  await call("/__lab/login", { method: "POST", form: { email: ALLOWED }, env: { ...ENV, LAB_EMAIL_FROM: "spoof@example.com" } });
  assert.equal(sent[0].body.from, DEFAULT);
});
