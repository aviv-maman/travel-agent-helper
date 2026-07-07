"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from ".";

/**
 * Persist an avatar the user just uploaded to Supabase Storage (docs/file-upload-contract.md).
 * The backend signed a presigned PUT and the browser uploaded straight to storage;
 * here we only record the resulting URL. NEVER trust the client-supplied URL —
 * re-validate it against the configured storage public base and the `avatar/` prefix,
 * so a malicious client can't point the avatar at an arbitrary URL.
 */

export type AvatarState = { ok?: boolean; error?: "forbidden" | "invalid" };

export async function setAvatar(key: string, publicUrl: string): Promise<AvatarState> {
  const user = await getCurrentUser();
  if (!user) return { error: "forbidden" };

  const base = process.env.SUPABASE_PUBLIC_BASE_URL?.replace(/\/$/, "");
  // The URL is base + the server-chosen key, plus an optional `?v=<hex>` cache-buster
  // (avatars are keyed per-user and overwritten in place, so the bare URL is stable).
  const [bareUrl, query] = publicUrl.split("?");
  if (
    !base ||
    !key.startsWith("avatar/") ||
    bareUrl !== `${base}/${key}` ||
    (query !== undefined && !/^v=[0-9a-f]{1,32}$/.test(query))
  ) {
    return { error: "invalid" };
  }

  await db.update(users).set({ avatarUrl: publicUrl }).where(eq(users.id, user.id));
  revalidatePath("/[locale]/account/profile", "page");
  return { ok: true };
}

export async function removeAvatar(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await db.update(users).set({ avatarUrl: null }).where(eq(users.id, user.id));
  revalidatePath("/[locale]/account/profile", "page");
}
