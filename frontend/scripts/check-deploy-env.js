#!/usr/bin/env node
/**
 * Guard the deploy path: CRA inlines REACT_APP_API_URL at build time, so a
 * `npm run deploy` without it ships a SPA that calls http://localhost:8000 for
 * every visitor. Fail loudly here (runs in `predeploy`) so that can't happen.
 *
 * Not wired into plain `npm run build` on purpose — CI uses that only to verify
 * the bundle compiles, where a real API URL isn't needed.
 */
if (!process.env.REACT_APP_API_URL) {
  console.error(
    "\n✗ REACT_APP_API_URL is not set.\n" +
      "  A production deploy must set it (the SPA calls it at runtime); otherwise\n" +
      "  the build bakes in http://localhost:8000. Example:\n\n" +
      "    REACT_APP_API_URL=https://api.bringthebuzzover.com npm run deploy\n",
  );
  process.exit(1);
}
console.log(`✓ REACT_APP_API_URL = ${process.env.REACT_APP_API_URL}`);
