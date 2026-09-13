import brandEmails from "@brandEmails";

/** Same rule as backend ``_ops_cc``: contact + ops, skip blanks/dupes/To. */
export function opsCcAddresses(toEmail: string): string[] {
  const skip = toEmail.trim().toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const addr of [brandEmails.contactEmail, brandEmails.opsCcEmail]) {
    const value = addr.trim();
    const key = value.toLowerCase();
    if (!value || key === skip || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function composeDefaultBody(recipientName: string): string {
  const name = recipientName.trim() || "there";
  return (
    `Hi ${name},\n\n\n` +
    `—\nThis email was sent by Buzz. Replies go to ${brandEmails.contactEmail}.`
  );
}
