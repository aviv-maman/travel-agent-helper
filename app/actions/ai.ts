"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { backendUrl } from "@/lib/ai/backend";
import { saveCredentialToBackend, deleteCredentialFromBackend } from "@/lib/ai/credentials";
import { saveQuote, deleteSavedQuote, buildQuoteTitle } from "@/lib/ai/quotes";
import { AI_ENABLED_COOKIE, AI_MOCK_KEY_COOKIE, DEFAULT_AI_PROVIDER } from "@/lib/ai/constants";

/**
 * Server actions for the AI quote assistant. Credential writes proxy to the
 * backend (which validates + encrypts) — Next never persists the plaintext key.
 * Saved-quote writes go straight to Neon via the DAL. Every action re-checks
 * the session as the real security boundary. See docs/ai-quote-assistant-contract.md.
 */

const COOKIE_BASE = {
  path: "/" as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
};

// --- Credentials ------------------------------------------------------------

export type KeyFormState = {
  ok?: boolean;
  last4?: string;
  error?: "empty" | "invalidKey" | "rateLimited" | "backend" | "forbidden";
};

/** Validate + store the user's AI key. On success reveals the Assistant nav link. */
export async function saveAiKey(
  locale: string,
  _prev: KeyFormState,
  formData: FormData,
): Promise<KeyFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "forbidden" };

  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (!apiKey) return { error: "empty" };
  const provider = DEFAULT_AI_PROVIDER;

  const store = await cookies();
  let last4: string;

  if (backendUrl()) {
    const result = await saveCredentialToBackend(provider, apiKey);
    if (!result.ok) return { error: result.error };
    last4 = result.last4;
  } else {
    // No backend yet: mock the "configured" state so the flow is clickable.
    last4 = apiKey.slice(-4);
    store.set(AI_MOCK_KEY_COOKIE, last4, { ...COOKIE_BASE, httpOnly: true });
  }

  // Readable nav mirror (both paths).
  store.set(AI_ENABLED_COOKIE, "1", { ...COOKIE_BASE, httpOnly: false });
  revalidatePath("/[locale]/account/ai", "page");
  revalidatePath("/[locale]/assistant", "page");
  return { ok: true, last4 };
}

/** Delete the stored key and hide the assistant again. Bound with `locale`. */
export async function deleteAiKey(_locale: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  if (backendUrl()) {
    await deleteCredentialFromBackend(DEFAULT_AI_PROVIDER);
  }
  const store = await cookies();
  store.delete(AI_MOCK_KEY_COOKIE);
  store.delete(AI_ENABLED_COOKIE);
  revalidatePath("/[locale]/account/ai", "page");
  revalidatePath("/[locale]/assistant", "page");
}

// --- Saved quotes -----------------------------------------------------------

export type SaveQuoteResult = { ok: true; id: number } | { error: "empty" | "forbidden" };

/**
 * Persist a quote the user explicitly chose to save. `content` is the forwardable
 * message; `prompt` is the originating request (used for the derived title);
 * `hadImage` records whether the request carried an image. The chat itself is
 * never auto-saved.
 *
 * Until the R2/file-upload backend exists we don't persist the real bytes, so in
 * mock/dev (no `BACKEND_URL`) a quote that had an image is tagged with the `mock`
 * sentinel `imageKey`, which the UI resolves to the bundled sample image.
 */
export async function saveQuoteAction(
  content: string,
  prompt: string,
  hadImage = false,
): Promise<SaveQuoteResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "forbidden" };
  const text = content.trim();
  if (!text) return { error: "empty" };

  const id = await saveQuote(user.id, {
    title: buildQuoteTitle(prompt, text),
    content: text,
    prompt: prompt.trim(),
    imageKey: hadImage && backendUrl() === null ? "mock" : null,
  });
  revalidatePath("/[locale]/assistant", "page");
  return { ok: true, id };
}

/** Delete a saved quote from the history list. */
export async function deleteQuoteAction(id: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await deleteSavedQuote(user.id, id);
  revalidatePath("/[locale]/assistant", "page");
}
