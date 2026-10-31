/**
 * Auth routes that leave the marketing chrome.
 *
 * The public header and footer stay on legal and status pages. Split auth
 * and the admin login shell replace that chrome for the frames that draw
 * their own.
 */

const ASIDE_AUTH_PATHS = new Set([
  "/login",
  "/brand/login",
  "/brand/forgot-password",
  "/brand/reset-password",
  "/brand/setup",
  "/brand/apply",
  "/org/apply",
  "/reconnect-instagram",
]);

const ADMIN_AUTH_PATHS = new Set([
  "/admin/login",
]);

export function isAdminAuthPath(pathname: string): boolean {
  return ADMIN_AUTH_PATHS.has(pathname);
}

export function isBareAuthPath(pathname: string): boolean {
  return ASIDE_AUTH_PATHS.has(pathname) || ADMIN_AUTH_PATHS.has(pathname);
}
