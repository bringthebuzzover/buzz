/**
 * Wire types for the `{ data, meta, error }` envelope every endpoint returns
 * (architecture §5.2). `meta` carries pagination for list endpoints.
 */

export type Meta = {
  page: number;
  per_page: number;
  total: number;
};

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
};

export type ApiEnvelope<T> = {
  data: T;
  meta: Meta | null;
  error: ApiErrorPayload | null;
};
