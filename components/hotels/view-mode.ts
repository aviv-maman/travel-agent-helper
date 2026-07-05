/**
 * Hotel results layout preference. Plain module (no "use client") so both the
 * client hook (`use-view-mode.ts`) and the server page can import the cookie name
 * and parser. The choice is stored in a cookie — read at SSR so the initial
 * render matches the client (no list⇄grid flash), mirroring the saved-quotes
 * `quote_history_view` preference.
 */
export type ViewMode = "list" | "grid";

export const HOTELS_VIEW_MODE_COOKIE = "hotelsViewMode";

/** Coerce a raw cookie value to a `ViewMode`, defaulting to "list". */
export function parseViewMode(value: string | undefined): ViewMode {
  return value === "grid" ? "grid" : "list";
}
