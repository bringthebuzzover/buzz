/**
 * Demo persona ("view") types — internal demo users can experience the site as either a Brand
 * partner or a Student Organization. Real users belong to exactly one portal in production.
 */

/** Which portal the demo session is currently emulating. */
export type DemoView = "brand" | "org";

/** Allowed values for runtime validation (e.g. when reading from sessionStorage). */
export const DEMO_VIEW_VALUES = ["brand", "org"] as const satisfies readonly DemoView[];

/** Type guard for safely narrowing unknown values (storage, query strings, etc.) into `DemoView`. */
export function isDemoView(value: unknown): value is DemoView {
  return (
    typeof value === "string" &&
    (DEMO_VIEW_VALUES as readonly string[]).includes(value)
  );
}

/** Human-readable labels used in menus, headers, and chooser cards. */
export const DEMO_VIEW_LABELS: Record<DemoView, string> = {
  brand: "Brand",
  org: "Student Org",
};
