import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { dashboardScratchpad } from "@/db/schema";

/**
 * The dashboard scratchpad is a single free-form text row per user, upserted on
 * save (debounced auto-save from the client). Ownership-scoped by `userId`.
 */

/** The user's scratchpad text (empty string if they have no row yet). */
export async function getScratchpad(userId: number): Promise<string> {
  const [row] = await db
    .select({ content: dashboardScratchpad.content })
    .from(dashboardScratchpad)
    .where(eq(dashboardScratchpad.userId, userId));
  return row?.content ?? "";
}

/** Create or replace the user's scratchpad text. */
export async function upsertScratchpad(userId: number, content: string): Promise<void> {
  await db
    .insert(dashboardScratchpad)
    .values({ userId, content, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: dashboardScratchpad.userId,
      set: { content, updatedAt: new Date() },
    });
}
