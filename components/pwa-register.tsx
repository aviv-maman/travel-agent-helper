"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (`/sw.js`) in production only — it enables
 * installability (the Android install prompt) + the offline shell. Dev is
 * skipped so it never interferes with HMR.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () =>
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* best-effort — the app works fine without the SW */
      });
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
