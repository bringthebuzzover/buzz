---
name: buzz-staging-operations
description: >-
  BUZZ staging/lab deployment verification and operations boundaries for
  Railway, Cloudflare, access gates, allowlists, and test access. Read-only
  unless the specific write is explicitly approved.
---

# BUZZ staging operations

Use `buzz-coding-agent` for code and PR work and
`buzz-design-and-brand` for logos and pen match.

## Establish the target

- Run `buzz-coding-agent` (active-checkout discovery).
  Use current instructions/context for branch and rollout policy. Missing app
  code makes code/build steps not applicable; it does not select a live target.
  Production promotion requires separate approval.
- Staging and production are distinct operational targets. Lab is a separate
  design build, not an automatic copy of the app feature branch.
- Gate/allowlist runbooks and deployment assets belong to the separate private
  operations repository. This public repo does not authorize writes there.
- Resolve current hosts, project/service selection, preview rules, and access
  details from the caller's authorized operational context. Never guess from
  a label, copy private identifiers here, or probe production as a fallback.
- Resolve deployment and Meta guidance through discovery: it may be local or
  in authorized private operations sources/context packs. Verify target metadata
  read-only and report conflicting/missing context before acting. A checkout's
  branch name is never sufficient evidence of a deployment target.

Environment-specific gate behavior is settings-driven, never a staging-only
application-code fork. Do not enable staging access settings in production.
The API's `ENVIRONMENT=staging` value is a hardened configuration mode; it
alone does not prove which infrastructure or database a service targets.

## Verify an approved staging deployment

1. Confirm the caller-authorized source revision and rollout branch, and match the selected
   deployment, environment, service, and source SHA before reading logs.
2. Frontend-only changes may leave backend/cron deployments unchanged.
   Check the replacement deployment before treating shutdown SIGTERM or a
   superseded deployment status as an incident.
3. Verify the documented health endpoint exists (commonly `/api/health`),
   check the intended staging API for its expected response, and verify the
   changed screens. Health alone does not prove the changed behavior works.
   UI control requires separate permission for each action.
4. Report SHA, target role, health and screen evidence, and remaining failures.
   Do not redeploy, seed accounts, run jobs, migrate data, or promote to production
   as part of verification without explicit approval.

## Gates, allowlists, lab, and previews

For an authorized read-only comparison, obtain the canonical allowlist from the
private operations source and compare only the relevant API/gate settings.
Normalize and sort entries, then report match/mismatch without dumping real
emails, secrets, unrelated bindings, or full live values.

Changing an allowlist, deploying a gate asset, widening preview branches, or
syncing a lab logo requires approval for that specific target and write. Preserve
all unrelated bindings and secrets; re-read the resulting state to verify it.
Check the selected branch for lab build scripts and staging-only assets.
The operations owner verifies branch-specific build/preview rules.
Logo match guidance lives in `buzz-design-and-brand`.

## Service and credential boundaries

Railway, Cloudflare, Resend, Meta, Hostinger, and admin tools are read-only by
default. Specific approval is required for variables, redeploys, DNS/nameservers,
proxy settings, keys, app-review/dashboard changes, and data mutations.
Prefer direct tools and narrow reads; never print credentials or whole variable
sets. Do not use a generic infrastructure agent to make unreviewed changes.
A set/overwrite operation does not prove a variable was deleted; verify removal.

Use the caller's authorized credential/vault and connected test-inbox workflow
for staging access. Do not assume a vault is empty or that a connector exists.
If access is unavailable, report the blocker; never request passwords in chat,
harvest another inbox, or publish verification codes. Do not send mail.
