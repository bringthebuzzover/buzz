/**
 * The shared API client (architecture §6.1): base-URL prefixing, JWT attach,
 * envelope unwrap, and a single-shot 401→refresh→replay interceptor. Every
 * later slice fetches through `apiFetch`.
 */
import {
  endImpersonation,
  getAccessToken,
  isImpersonating,
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

/**
 * Fetch `path` through the envelope. On a `TOKEN_EXPIRED` 401 it refreshes the
 * access token once and replays the request exactly once; a second failure (or
 * a failed refresh) propagates the `ApiError`.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  try {
    return await doFetch<T>(path, init);
  } catch (err) {
    if (err instanceof ApiError && err.code === "TOKEN_EXPIRED") {
      // The refresh cookie belongs to the admin, not the impersonated user, so
      // refreshing here would quietly escalate the session. End impersonation
      // via full navigation — this module must not import Router/QueryClient;
      // UI Exit uses useEndImpersonation (SPA) instead.
      if (isImpersonating()) {
        endImpersonation("expired");
        throw err;
      }
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return await doFetch<T>(path, init);
      }
      setAccessToken(null);
    }
    throw err;
  }
}
