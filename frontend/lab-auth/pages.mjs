// HTML for the Lab login. No scripts: plain forms, so the CSP can forbid JS.
// Look matches /pulse2: ink #0b0b0b, paper #f0f0f0, yellow #f6d32a, Switzer.

export const ASSET_BASE = "/__lab/assets";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLE = `
@font-face{font-family:Switzer;src:url("${ASSET_BASE}/switzer-400.woff2") format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:Switzer;src:url("${ASSET_BASE}/switzer-500.woff2") format("woff2");font-weight:500;font-display:swap}
:root{--ink:#0b0b0b;--paper:#f0f0f0;--yellow:#f6d32a;--yellow-hover:#e0be16;--yellow-14:color-mix(in srgb,#f6d32a 14%,transparent);--paper-60:color-mix(in srgb,#f0f0f0 60%,transparent);--paper-16:color-mix(in srgb,#f0f0f0 16%,transparent);--side:clamp(1rem,3.3vw,3rem)}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--ink);color:var(--paper);font-family:Switzer,ui-sans-serif,system-ui,sans-serif;font-weight:400;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;min-height:100svh;display:flex;flex-direction:column}
a{color:inherit}
.top{display:flex;align-items:center;justify-content:space-between;padding:20px var(--side)}
.brand{display:block;width:124px;height:32px;overflow:hidden;line-height:0}
.brand img{height:58px;width:auto;margin-top:-6px;margin-left:-2px}
.tag{font-size:13px;color:var(--paper-60);border:1px solid var(--paper-16);border-radius:999px;padding:4px 12px}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:32px var(--side) 64px;position:relative;overflow:hidden}
.glow{position:absolute;width:min(720px,140vw);aspect-ratio:1;border-radius:50%;background:radial-gradient(closest-side,var(--yellow-14),transparent);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none}
.card{position:relative;width:100%;max-width:420px}
.bee{width:44px;height:44px;display:block;margin-bottom:28px;filter:drop-shadow(0 0 18px var(--yellow-14))}
.kicker{font-size:13px;color:var(--yellow);margin:0 0 12px;letter-spacing:.02em}
h1{font-weight:500;font-size:clamp(2.25rem,4vw,3rem);line-height:1.02;letter-spacing:-.02em;margin:0 0 16px}
.lede{color:var(--paper-60);margin:0 0 32px}
.lede strong{color:var(--paper);font-weight:500}
label{display:block;font-size:13px;color:var(--paper-60);margin-bottom:8px}
input{width:100%;min-height:52px;padding:0 16px;border-radius:12px;border:1px solid var(--paper-16);background:transparent;color:var(--paper);font:inherit;font-size:17px;outline:none;transition:border-color .2s ease}
input:focus{border-color:var(--yellow)}
input.code{font-size:28px;letter-spacing:.42em;text-align:center;font-weight:500;font-variant-numeric:tabular-nums;padding-left:calc(16px + .42em)}
button{margin-top:16px;width:100%;min-height:52px;border:0;border-radius:999px;background:var(--yellow);color:var(--ink);font:inherit;font-size:16px;font-weight:500;cursor:pointer;transition:background-color .3s ease}
button:hover{background:var(--yellow-hover)}
button:focus-visible,a:focus-visible{outline:2px solid var(--yellow);outline-offset:3px}
.note{margin:16px 0 0;padding:12px 16px;border-radius:12px;font-size:14px;background:var(--yellow-14);color:var(--paper)}
.note.error{background:color-mix(in srgb,#ff6b5a 16%,transparent)}
.links{margin-top:24px;font-size:14px;color:var(--paper-60);display:flex;gap:16px;flex-wrap:wrap}
.links a{text-underline-offset:3px}
.links form{display:inline}
.links button{all:unset;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
footer{padding:20px var(--side);font-size:13px;color:var(--paper-60)}
@media (max-width:520px){.top{padding-top:16px}main{align-items:flex-start;padding-top:40px}h1{font-size:2.25rem}}
`;

function layout({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(title)} · BUZZ Lab</title>
<link rel="icon" href="${ASSET_BASE}/bee.svg" type="image/svg+xml">
<style>${STYLE}</style>
</head>
<body>
<header class="top">
  <span class="brand"><img src="${ASSET_BASE}/buzz-logo.svg" alt="BUZZ"></span>
  <span class="tag">Lab · Private preview</span>
</header>
<main>
  <div class="glow" aria-hidden="true"></div>
  <div class="card">
    <img class="bee" src="${ASSET_BASE}/bee.svg" alt="" aria-hidden="true">
${body}
  </div>
</main>
<footer>BUZZ design lab. Not the live site.</footer>
</body>
</html>`;
}

function note(message, kind) {
  if (!message) return "";
  const role = kind === "error" ? "alert" : "status";
  return `<p class="note${kind === "error" ? " error" : ""}" role="${role}">${escapeHtml(message)}</p>`;
}

export function loginPage({ next = "/", email = "", message = "", kind = "info" } = {}) {
  return layout({
    title: "Sign in",
    body: `    <p class="kicker">BUZZ Lab</p>
    <h1>Sign in</h1>
    <p class="lede">Enter your email and we'll send you a 6-digit code.</p>
    <form method="post" action="/__lab/login" novalidate>
      <input type="hidden" name="next" value="${escapeHtml(next)}">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required maxlength="254" value="${escapeHtml(email)}" autofocus>
      <button type="submit">Send code</button>
    </form>
    ${note(message, kind)}`,
  });
}

export function codePage({ next = "/", email = "", message = "", kind = "info" } = {}) {
  return layout({
    title: "Enter code",
    body: `    <p class="kicker">BUZZ Lab</p>
    <h1>Check your email</h1>
    <p class="lede">If <strong>${escapeHtml(email)}</strong> is allowed, a code is on its way. It works for 10 minutes.</p>
    <form method="post" action="/__lab/verify" novalidate>
      <input type="hidden" name="next" value="${escapeHtml(next)}">
      <label for="code">6-digit code</label>
      <input id="code" class="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus>
      <button type="submit">Open the Lab</button>
    </form>
    ${note(message, kind)}
    <p class="links"><a href="/__lab/login?next=${encodeURIComponent(next)}">Use a different email</a></p>`,
  });
}

export function signOutPage() {
  return layout({
    title: "Sign out",
    body: `    <p class="kicker">BUZZ Lab</p>
    <h1>Sign out?</h1>
    <p class="lede">This signs you out of the Lab on this browser.</p>
    <form method="post" action="/__lab/logout">
      <button type="submit">Sign out</button>
    </form>
    <p class="links"><a href="/">Back to the Lab</a></p>`,
  });
}

export function signedOutPage() {
  return layout({
    title: "Signed out",
    body: `    <p class="kicker">BUZZ Lab</p>
    <h1>Signed out</h1>
    <p class="lede">You're signed out of the Lab on this browser.</p>
    <p class="links"><a href="/__lab/login">Sign in again</a></p>`,
  });
}

export function misconfiguredPage(missing) {
  return layout({
    title: "Unavailable",
    body: `    <p class="kicker">BUZZ Lab</p>
    <h1>Lab is locked</h1>
    <p class="lede">The Lab login isn't configured, so everything stays closed. The site owner needs to set: <strong>${escapeHtml(missing.join(", "))}</strong>.</p>`,
  });
}

export function notFoundPage() {
  return layout({
    title: "Not found",
    body: `    <p class="kicker">BUZZ Lab</p>
    <h1>Not found</h1>
    <p class="links"><a href="/__lab/login">Go to sign in</a></p>`,
  });
}
