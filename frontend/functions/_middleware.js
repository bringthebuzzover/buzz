// Cloudflare Pages Functions middleware for the BUZZ Lab (Pages root is
// `frontend`, so this folder deploys with the lab project). It is a no-op
// unless LAB_AUTH=1. Railway serves `frontend/build` only and never runs
// this. See docs/LAB.md → "Lab login".
export { onRequest } from "../lab-auth/handler.mjs";
