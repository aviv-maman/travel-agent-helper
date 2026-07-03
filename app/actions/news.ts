"use server";

import { updateTag } from "next/cache";
import { can } from "@/lib/auth";
import { NEWS_TAG } from "@/lib/news";

/**
 * Force-refresh the aggregated news feed. Gated server-side — the UI only shows
 * the button to permitted users, but this re-check is the real boundary.
 *
 * `updateTag` (vs `revalidateTag`) is the Server Action variant: it purges the
 * tagged source fetches and gives read-your-own-writes, so the re-render right
 * after the click already shows the fresh feed.
 */
export async function refreshNews(): Promise<void> {
  if (!(await can("news:revalidate"))) return;
  updateTag(NEWS_TAG);
}
