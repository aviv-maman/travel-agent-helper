"use server";

import { revalidateTag } from "next/cache";
import { NEWS_TAG } from "@/lib/news";
import { can } from "@/lib/auth";

/**
 * Refresh the aggregated news feed on demand. This is the *real* authorization
 * gate — it runs on the server and can't be bypassed by the client, so it's
 * safe even if the button is somehow rendered for an unauthorized user.
 */
export async function refreshNews(): Promise<{ ok: boolean; error?: string }> {
  if (!(await can("news:revalidate"))) {
    return { ok: false, error: "unauthorized" };
  }
  revalidateTag(NEWS_TAG, "max");
  return { ok: true };
}
