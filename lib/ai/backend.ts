import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

/**
 * Thin client for the separate Python backend (see docs/backend-overview.md).
 * The backend owns the AI-key encryption key and the Claude calls; Next reaches
 * it server-to-server via `BACKEND_URL`. Until that service exists the URL is
 * unset and callers fall back to local mocks.
 */

/** Base URL of the backend, or null when it isn't configured yet. */
export function backendUrl(): string | null {
  const url = process.env.BACKEND_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

/**
 * Fetch a backend endpoint, forwarding the caller's `session` cookie so the
 * backend can validate it exactly as lib/auth/session.ts does. Throws if
 * `BACKEND_URL` is unset — callers must guard with `backendUrl()` first.
 */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = backendUrl();
  if (!base) throw new Error("BACKEND_URL is not configured");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const headers = new Headers(init.headers);
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  return fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, { ...init, headers });
}

/**
 * Ask the backend to free quote screenshots after their saved_quotes rows were
 * deleted (POST /files/delete-quote-images — service-key auth, like email send).
 * The backend re-checks each key is unreferenced and prefix-guards to `quote/`.
 * Best-effort: rows are the source of truth; on any failure the object is merely
 * orphaned (never resurrected), so callers don't need the result.
 */
export async function deleteQuoteImages(keys: string[]): Promise<void> {
  const base = backendUrl();
  const serviceKey = process.env.SERVICE_KEY;
  if (!base || !serviceKey || keys.length === 0) return;
  try {
    await fetch(`${base}/files/delete-quote-images`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-service-key": serviceKey },
      body: JSON.stringify({ keys }),
    });
  } catch {
    // Backend down — the object stays orphaned; nothing to surface to the user.
  }
}
