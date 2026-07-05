"use client";

import { useSyncExternalStore } from "react";
import { AI_ENABLED_COOKIE } from "./constants";

/**
 * Client mirror of "AI is configured", read from the `ai_enabled` cookie the same
 * way the nav reads the public-user cookie. Lets the Assistant link appear/hide
 * without the root layout reading the session server-side (which would make every
 * public page dynamic). The server DAL stays the real gate. A custom event makes
 * the nav update instantly after save/delete, without a reload.
 */

const CHANGE_EVENT = "ai-enabled-change";

function readCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").includes(`${AI_ENABLED_COOKIE}=1`);
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

/** Reactive "does this user have an AI key configured" for Client Components. */
export function useAiEnabled(): boolean {
  return useSyncExternalStore(subscribe, readCookie, () => false);
}

/** Set/clear the mirror cookie and notify subscribers immediately. */
export function setAiEnabled(enabled: boolean): void {
  if (typeof document === "undefined") return;
  const maxAge = enabled ? 60 * 60 * 24 * 365 : 0;
  document.cookie = `${AI_ENABLED_COOKIE}=${enabled ? "1" : ""}; path=/; max-age=${maxAge}; samesite=lax`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
