/**
 * API client configuration. The base URL comes from `REACT_APP_API_URL`
 * (documented in `.env.example`); it falls back to the local FastAPI dev server.
 */
export const API_BASE_URL =
  process.env.REACT_APP_API_URL ?? "http://localhost:8000";
