// Unit tests for the Lab login gate. Run: npm run test:lab-auth (Node 20+).
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { onRequest, readConfig, safeNext, MAX_ATTEMPTS, SESSION_TTL, CODE_TTL } from "./handler.mjs";
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
function call(path, { method = "GET", env = ENV, cookies = {}, form, ip = "203.0.113.9" } = {}) {
  const headers = new Headers({ "CF-Connecting-IP": ip });
  const jar = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  if (jar) headers.set("Cookie", jar);
  let body;
  if (form) {
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    headers.set("Origin", ORIGIN);
    body = new URLSearchParams(form).toString();
  }
  const request = new Request(ORIGIN + path, { method, headers, body });
  let nextCalled = false;
  return onRequest({
    request,
    env,
    next: async () => { nextCalled = true; return LAB.clone(); },
  }).then((res) => Object.assign(res, { nextCalled }));
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

test("LAB_AUTH unset: middleware is a pass-through", async () => {
  for (const env of [{}, { LAB_AUTH: "" }, { LAB_AUTH: "0" }, { LAB_AUTH: "false" }]) {
    const res = await call("/", { env });
    assert.equal(res.nextCalled, true);
    assert.equal(await res.text(), "LAB DIRECTORY");
  }
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
  const asset = await call("/__lab/assets/switzer-400.woff2");
  assert.equal(asset.nextCalled, true);
  assert.equal(asset.headers.get("X-Robots-Tag"), "noindex, nofollow");
});

test("allowlisted email gets a code by email; right code opens the Lab", async () => {
  const { res, challenge } = await requestCode("Hello@Example.com ");
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), "/__lab/verify?next=%2Fpulse2");
  assert.ok(challenge);
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
  assert.ok(jar.lab_session.value);
  assert.match(jar.lab_session.line, /HttpOnly/);
  assert.match(jar.lab_session.line, /Secure/);
  assert.match(jar.lab_session.line, /SameSite=Lax/);
  assert.match(jar.lab_session.line, new RegExp(`Max-Age=${SESSION_TTL}`));
  assert.match(jar.lab_challenge.line, /Max-Age=0/);

  const lab = await call("/", { cookies: { lab_session: jar.lab_session.value } });
  assert.equal(lab.nextCalled, true);
  assert.equal(await lab.text(), "LAB DIRECTORY");
  assert.equal(lab.headers.get("X-Robots-Tag"), "noindex, nofollow");

  // The challenge cannot be reused after success.
  const again = await call("/__lab/verify", { method: "POST", form: { code }, cookies: { lab_challenge: challenge } });
  assert.equal(again.status, 400);
  assert.equal(setCookies(again).lab_session, undefined);
});

test("non-allowlisted email: same response, no email sent, no code works", async () => {
  const a = await requestCode(ALLOWED, "198.51.100.1");
  const b = await requestCode("stranger@example.com", "198.51.100.2");
  assert.equal(sent.length, 1, "only the allowlisted address got mail");
  assert.equal(b.res.status, a.res.status);
  assert.equal(b.res.headers.get("Location"), a.res.headers.get("Location"));
  assert.ok(b.challenge);
  const page = await call("/__lab/verify", { cookies: { lab_challenge: b.challenge } });
  assert.match(await page.text(), /If <strong>stranger@example.com<\/strong> is allowed, a code is on its way/);
  for (const code of ["000000", "123456"]) {
    const res = await call("/__lab/verify", { method: "POST", form: { code }, cookies: { lab_challenge: b.challenge } });
    assert.equal(setCookies(res).lab_session, undefined);
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
    assert.equal(setCookies(res).lab_session, undefined);
    cookie = setCookies(res).lab_challenge.value;
  }
  const last = await call("/__lab/verify", { method: "POST", form: { code: wrong }, cookies: { lab_challenge: cookie } });
  assert.match(await last.text(), /Too many wrong codes/);
  // Even the right code is refused now, including with the original cookie replayed.
  for (const c of [cookie, challenge]) {
    const res = await call("/__lab/verify", { method: "POST", form: { code }, cookies: { lab_challenge: c } });
    assert.equal(setCookies(res).lab_session, undefined);
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
    assert.equal(setCookies(res).lab_session, undefined);
  } finally {
    Date.now = realNow;
  }
  const now = Math.floor(Date.now() / 1000);
  const stale = await signToken(SECRET, "session", { e: ALLOWED, iat: now - SESSION_TTL - 5, exp: now - 5 });
  const res = await call("/", { cookies: { lab_session: stale } });
  assert.equal(res.status, 302);
  const fresh = await signToken(SECRET, "session", { e: ALLOWED, iat: now, exp: now + 60 });
  assert.equal((await call("/", { cookies: { lab_session: fresh } })).nextCalled, true);
});

test("forged, cross-purpose and de-allowlisted sessions are rejected", async () => {
  const now = Math.floor(Date.now() / 1000);
  const wrongKey = await signToken("another-secret-0123456789-abcdefghijk", "session", { e: ALLOWED, exp: now + 60 });
  const wrongPurpose = await signToken(SECRET, "challenge", { e: ALLOWED, exp: now + 60 });
  const removed = await signToken(SECRET, "session", { e: "gone@example.com", exp: now + 60 });
  for (const token of [wrongKey, wrongPurpose, removed, "v1.e30.AAAA", "garbage"]) {
    const res = await call("/", { cookies: { lab_session: token } });
    assert.equal(res.status, 302);
    assert.equal(res.nextCalled, false);
  }
});

test("logout clears the session cookie", async () => {
  const res = await call("/__lab/logout");
  assert.equal(res.status, 200);
  const jar = setCookies(res);
  assert.match(jar.lab_session.line, /Max-Age=0/);
  assert.match(await res.text(), /Signed out/);
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
  assert.equal(readConfig({}).enabled, false);
});
