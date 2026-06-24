"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ViewMode = "list" | "grid";

const STORAGE_KEY = "hotelsViewMode";
const VIEW_MODE_EVENT = "hotelsViewModeChange";

// In-memory fallback so the choice still sticks when localStorage is
// unavailable (e.g. private browsing) or throws.
let memoryMode: ViewMode = "list";

function subscribe(callback: () => void) {
  // `storage` fires for changes from other tabs; the custom event covers
  // same-tab updates (storage events never fire in the tab that wrote them).
  window.addEventListener("storage", callback);
  window.addEventListener(VIEW_MODE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(VIEW_MODE_EVENT, callback);
  };
}

function getSnapshot(): ViewMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "grid" || stored === "list") return stored;
  } catch {
    /* storage unavailable — fall back to the in-memory choice */
  }
  return memoryMode;
}

/**
 * Hotel results layout (list / grid). Defaults to "list" and persists the
 * user's choice in localStorage. Modeled as an external store so the
 * server-rendered markup and the first client render stay in sync.
 */
export function useViewMode(): [ViewMode, (_mode: ViewMode) => void] {
  const mode = useSyncExternalStore(subscribe, getSnapshot, () => "list" as ViewMode);

  const update = useCallback((next: ViewMode) => {
    memoryMode = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — keep the in-memory choice */
    }
    window.dispatchEvent(new Event(VIEW_MODE_EVENT));
  }, []);

  return [mode, update];
}
