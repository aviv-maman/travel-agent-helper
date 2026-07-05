import "server-only";
import { cookies } from "next/headers";
import { backendUrl, backendFetch } from "./backend";
import { AI_MOCK_KEY_COOKIE, DEFAULT_AI_PROVIDER, type AiProvider } from "./constants";

/**
 * Read side of the BYO AI-key store. The plaintext key never touches Next — the
 * backend encrypts it at rest and returns only metadata (`provider`, `last4`).
 * When `BACKEND_URL` is unset we serve a local mock so the UI is exercisable.
 * Writes live in app/actions/ai.ts (they also set cookies). See
 * docs/ai-quote-assistant-contract.md.
 */

export type AiCredential = { provider: AiProvider; last4: string };

export type SaveKeyResult =
  | { ok: true; last4: string }
  | { ok: false; error: "invalidKey" | "rateLimited" | "backend" };

/** The caller's stored credential metadata for the default provider, or null. */
export async function getAiCredential(): Promise<AiCredential | null> {
  if (!backendUrl()) {
    const last4 = (await cookies()).get(AI_MOCK_KEY_COOKIE)?.value;
    return last4 ? { provider: DEFAULT_AI_PROVIDER, last4 } : null;
  }
  try {
    const res = await backendFetch("/ai/credentials", { method: "GET", cache: "no-store" });
    if (!res.ok) return null;
    const list = (await res.json()) as AiCredential[];
    return list.find((c) => c.provider === DEFAULT_AI_PROVIDER) ?? null;
  } catch {
    return null;
  }
}

/** Whether the caller has any AI key configured (drives the nav gate + chat access). */
export async function hasAiCredential(): Promise<boolean> {
  return (await getAiCredential()) !== null;
}

/**
 * Validate + store a key via the backend (which does the cheap validation call,
 * encrypts, and upserts). Maps Anthropic errors to clean codes. Never echoes the
 * key. Returns the `last4` for display.
 */
export async function saveCredentialToBackend(
  provider: AiProvider,
  apiKey: string,
): Promise<SaveKeyResult> {
  try {
    const res = await backendFetch("/ai/credentials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, apiKey }),
    });
    if (res.status === 401) return { ok: false, error: "invalidKey" };
    if (res.status === 429) return { ok: false, error: "rateLimited" };
    if (!res.ok) return { ok: false, error: "backend" };
    const data = (await res.json()) as { last4?: string };
    return { ok: true, last4: data.last4 ?? apiKey.slice(-4) };
  } catch {
    return { ok: false, error: "backend" };
  }
}

/** Remove the stored key for `provider` on the backend. */
export async function deleteCredentialFromBackend(provider: AiProvider): Promise<void> {
  await backendFetch(`/ai/credentials/${provider}`, { method: "DELETE" });
}
