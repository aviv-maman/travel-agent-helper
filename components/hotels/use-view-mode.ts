"use client";

import { useCallback, useSyncExternalStore } from "react";
import { HOTELS_VIEW_MODE_COOKIE, type ViewMode } from "./view-mode";

const VIEW_MODE_EVENT = "hotelsViewModeChange";

// In-memory fallback so the choice still sticks when cookies are unavailable
// (e.g. blocked) or `document` is missing.
let memoryMode: ViewMode = "list";

function subscribe(callback: () => void) {
  // The cookie has no native change event; a custom event covers same-tab
  // updates so the toggle re-renders immediately.
  window.addEventListener(VIEW_MODE_EVENT, callback);
  return () => window.removeEventListener(VIEW_MODE_EVENT, callback);
}

function getSnapshot(): ViewMode {
  if (typeof document === "undefined") return memoryMode;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${HOTELS_VIEW_MODE_COOKIE}=([^;]*)`));
  const value = match?.[1];
  if (value === "grid" || value === "list") return value;
  return memoryMode;
}

/**
 * Hotel results layout (list / grid), persisted in a cookie so the server can
 * render the chosen layout on first paint (no flash). `initialView` is the value
 * the page read from the cookie at SSR; it seeds the hydration snapshot so the
 * client's first render matches the server's.
 */
export function useViewMode(initialView: ViewMode): [ViewMode, (_mode: ViewMode) => void] {
  const mode = useSyncExternalStore(subscribe, getSnapshot, () => initialView);

  const update = useCallback((next: ViewMode) => {
    memoryMode = next;
    document.cookie = `${HOTELS_VIEW_MODE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event(VIEW_MODE_EVENT));
  }, []);

  return [mode, update];
}
