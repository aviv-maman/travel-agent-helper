"use client";

import { useEffect, useState } from "react";

export type ViewMode = "list" | "grid";

const STORAGE_KEY = "hotelsViewMode";

/**
 * Hotel results layout (list / grid). Defaults to "list" and persists the
 * user's choice in localStorage. Reads from storage after mount to keep the
 * server-rendered markup and the first client render in sync.
 */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>("list");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "list" || stored === "grid") setMode(stored);
  }, []);

  const update = (next: ViewMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — keep the in-memory choice */
    }
  };

  return [mode, update];
}
