"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { airlines } from "@/db/schema";
import { can } from "@/lib/auth";
import { FIGURE_RE, bareFigure } from "@/lib/airline-figures";

/**
 * Editor+ inline update of one airline row (the pencil on the airlines table):
 * suitcase kg, trolley kg, and commission. Values arrive and are stored as bare
 * figures ("23", "15/23", "0/5") — the ק"ג / % units are presentation only.
 *
 * These three fields are app-managed after bootstrap: `bun run seed` upserts an
 * airline's metadata but leaves kg/note/commission alone (see seed-content.ts),
 * so in-app edits survive re-seeds.
 *
 * No `revalidatePath`: the table calls `router.refresh()` on success (the
 * house convention for inline editors).
 */

export type SaveAirlineResult = { ok: true } | { error: "forbidden" | "invalid" | "offline" };

export async function saveAirlineRowAction(
  slug: string,
  patch: {
    kg: string;
    commission: string;
    /** Omitted = leave the trolley note untouched; "" clears it. */
    trolley?: string;
  },
): Promise<SaveAirlineResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };

  const kg = bareFigure(patch.kg).slice(0, 16);
  if (!FIGURE_RE.test(kg)) return { error: "invalid" };
  const commission = bareFigure(patch.commission).slice(0, 16);
  if (commission && !FIGURE_RE.test(commission)) return { error: "invalid" };

  const set: Partial<typeof airlines.$inferInsert> = {
    kg,
    commission: commission || null, // null renders as "0%"
  };
  if (patch.trolley !== undefined) {
    const trolley = bareFigure(patch.trolley).slice(0, 16);
    if (!trolley) {
      set.note = null;
      set.noteTone = null;
    } else if (FIGURE_RE.test(trolley)) {
      set.note = { he: `${trolley} ק"ג`, en: `${trolley} kg` };
      set.noteTone = null;
    } else {
      return { error: "invalid" };
    }
  }

  try {
    const updated = await db
      .update(airlines)
      .set(set)
      .where(eq(airlines.slug, slug.slice(0, 48)))
      .returning({ id: airlines.id });
    if (updated.length === 0) return { error: "invalid" };
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}
