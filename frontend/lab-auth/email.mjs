// Sends the Lab sign-in code through the Resend HTTP API.

import { escapeHtml } from "./pages.mjs";

// The verified Resend domain is bringthebuzzover.com (its return path and
// SPF live on send.bringthebuzzover.com). See DEPLOYMENT.md → Resend.
export const DEFAULT_FROM = "BUZZ Lab <lab@bringthebuzzover.com>";

export function codeEmail(code) {
  const subject = `BUZZ Lab code: ${code}`;
  const text = [
    `Your BUZZ Lab sign-in code is ${code}.`,
    "",
    "It works for 10 minutes. If you didn't ask for it, ignore this email.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0b0b0b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0b;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;font-family:Switzer,Helvetica,Arial,sans-serif;color:#f0f0f0;">
<tr><td style="font-size:22px;font-weight:700;letter-spacing:.04em;color:#f6d32a;padding-bottom:28px;">BUZZ<span style="color:#f0f0f0;font-weight:400;font-size:14px;letter-spacing:0;"> &nbsp;Lab</span></td></tr>
<tr><td style="font-size:28px;font-weight:500;line-height:1.1;padding-bottom:12px;">Your sign-in code</td></tr>
<tr><td style="font-size:15px;line-height:1.5;color:#a8a8a8;padding-bottom:24px;">Enter it on the BUZZ Lab page. It works for 10 minutes.</td></tr>
<tr><td style="padding-bottom:24px;"><div style="display:inline-block;background:#f6d32a;color:#0b0b0b;border-radius:14px;padding:16px 24px;font-size:34px;font-weight:700;letter-spacing:.3em;font-family:Menlo,Consolas,monospace;">${escapeHtml(code)}</div></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#7a7a7a;">If you didn't ask for this code, ignore this email. Nobody can sign in without it.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

export async function sendCodeEmail({ apiKey, from, to, code, fetchImpl = fetch }) {
  const { subject, text, html } = codeEmail(code);
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {}
    throw new Error(`Resend responded ${res.status}: ${detail}`);
  }
  return true;
}
