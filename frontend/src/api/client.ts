/**
 * The shared API client (architecture §6.1): base-URL prefixing, JWT attach,
 * envelope unwrap, and a single-shot 401→refresh→replay interceptor. Every
 * later slice fetches through `apiFetch`.
 *
 * Recoverable Buzz auth: TOKEN_EXPIRED (clock) and UNAUTHORIZED (token_version
 * rotation / revoked access). INSTAGRAM_TOKEN_EXPIRED is not recoverable here.
 */
import {
  endImpersonation,
  getAccessToken,
  isImpersonating,
  markInstagramReconnectLatch,
  notifyApiSessionLost,
  refreshAccessToken,
  setAccessToken,
} from "./auth";
import { API_BASE_URL } from "./config";
import { ApiError } from "./errors";
import type { ApiEnvelope, Meta } from "./types";

export type { Meta } from "./types";
export { ApiError } from "./errors";

export type ApiResult<T> = { data: T; meta: Meta | null };

async function doFetch<T>(
  path: string,
  init: RequestInit,
): Promise<ApiResult<T>> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const resp = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await resp.json()) as ApiEnvelope<T>;
  } catch {
    body = null;
  }

  if (!resp.ok || body?.error) {
    const code = body?.error?.code ?? "INTERNAL_ERROR";
    const message = body?.error?.message ?? `Request failed (${resp.status}).`;
    throw new ApiError(code, message, resp.status, body?.error?.details ?? null);
  }

  if (body === null) {
    throw new ApiError("INTERNAL_ERROR", "Malformed response.", resp.status);
  }

  return { data: body.data, meta: body.meta };
}

const RECOVERABLE_AUTH_CODES = new Set(["TOKEN_EXPIRED", "UNAUTHORIZED"]);

/**
 * Fetch `path` through the envelope. On Buzz `TOKEN_EXPIRED` or `UNAUTHORIZED`
 * (with a bearer) it refreshes once and replays once. On `INSTAGRAM_TOKEN_EXPIRED`
 * it latches reconnect framing and hard-navigates to `/reconnect-instagram`.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const tokenAtStart = getAccessToken();
  try {
    return await doFetch<T>(path, init);
  } catch (err) {
    if (err instanceof ApiError && err.code === "INSTAGRAM_TOKEN_EXPIRED") {
      markInstagramReconnectLatch();
      setAccessToken(null);
      window.location.href = "/reconnect-instagram";
      throw err;
    }
    if (err instanceof ApiError && RECOVERABLE_AUTH_CODES.has(err.code)) {
      // Refresh cookie is the admin's. Never refresh during View-as (would
      // escalate). Clock expiry ends impersonation; ver-mismatch must not —
      // remint on reload from the latch instead of dumping to /admin.
      if (isImpersonating()) {
        if (err.code === "TOKEN_EXPIRED") {
          endImpersonation("expired");
        }
        throw err;
      }
      if (!tokenAtStart) {
        throw err;
      }
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return await doFetch<T>(path, init);
      }
      // Failed refresh must not wipe a bearer login installed mid-flight.
      // Null only if the token is still the one this call started with, then
      // replay if a newer one appeared (acceptSession TOCTOU).
      if (getAccessToken() === tokenAtStart) {
        setAccessToken(null);
      }
      const latest = getAccessToken();
      if (latest && latest !== tokenAtStart) {
        return await doFetch<T>(path, init);
      }
      // Settled-session sign-out. Login/bootstrap races are ignored by the
      // handler unless status is already authenticated; mint durability plus
      // this CAS is what keeps post-login queries from bouncing to /login.
      if (!latest) {
        notifyApiSessionLost();
      }
    }
    throw err;
  }
}
