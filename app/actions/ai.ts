"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { backendUrl, deleteQuoteImages } from "@/lib/ai/backend";
import { saveCredentialToBackend, deleteCredentialFromBackend } from "@/lib/ai/credentials";
import { saveQuote, deleteSavedQuote } from "@/lib/ai/quotes";
import { buildQuoteTitle, forwardableMessage } from "@/lib/ai/quote-title";
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

/** The storage object of a quote's original image, already uploaded client-side via the
 *  backend's presigned PUT (see lib/ai/quote-image-upload.ts). */
export type QuoteImage = { imageKey: string; imageMediaType: string };

/**
 * Persist a quote the user explicitly chose to save. `content` is the forwardable
 * message; `prompt` is the originating request (used for the derived title);
 * `hadImage` records whether the request carried an image. The chat itself is
 * never auto-saved.
 *
 * When the storage backend is wired, the client uploads the original screenshot first
 * and passes its `image` (key + media type) here; we store the key on the row and
 * the history dialog resolves it through the ownership-checked backend endpoint.
 * In mock/dev (no `BACKEND_URL`, no upload) a quote that had an image is tagged
 * with the `mock` sentinel `imageKey`, which the UI resolves to a bundled sample.
 */
export async function saveQuoteAction(
  content: string,
  prompt: string,
  hadImage = false,
  image?: QuoteImage,
): Promise<SaveQuoteResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "forbidden" };
  const text = content.trim();
  if (!text) return { error: "empty" };
  // Persist only the forwardable client message — never the internal profit/cost
  // calculations that precede the fenced block. The title is still derived from
  // the full reply (that's where the fence + fallbacks live).
  const forwardable = forwardableMessage(text);

  // Only accept a key from our own quote-image prefix (defence-in-depth — the key
  // is browser-supplied). Keys are unguessable random uuids, but the prefix is the
  // ownership boundary the backend also enforces on read.
  const uploaded = image && image.imageKey.startsWith("quote/") ? image : null;

  const id = await saveQuote(user.id, {
    title: buildQuoteTitle(prompt, text),
    content: forwardable,
    prompt: prompt.trim(),
    imageKey: uploaded?.imageKey ?? (hadImage && backendUrl() === null ? "mock" : null),
    imageMediaType: uploaded?.imageMediaType ?? null,
  });
  revalidatePath("/[locale]/assistant", "page");
  return { ok: true, id };
}

/** Delete a saved quote from the history list, freeing its screenshot with it. */
export async function deleteQuoteAction(id: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const imageKey = await deleteSavedQuote(user.id, id);
  // Best-effort storage cleanup (the backend withholds keys other quotes still
  // share, and prefix-guards to quote/). The row is the source of truth — a
  // failed cleanup only orphans the object.
  if (imageKey && imageKey !== "mock") await deleteQuoteImages([imageKey]);
  revalidatePath("/[locale]/assistant", "page");
}
