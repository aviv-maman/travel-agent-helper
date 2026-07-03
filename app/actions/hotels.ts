"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { hotels } from "@/db/schema";
import { can } from "@/lib/auth";

export type UpdateScoreResult = { ok: true; score: number | null } | { error: string };

/**
 * Editor+ inline update of a hotel's Booking.com score. The UI only shows the
 * control to permitted users, but this re-check is the real security boundary.
 *
 * Writes to the DB only — a later `bun run seed` resets scores to
 * `data/seed.json`, so lasting changes should also be folded back into the seed.
 */
export async function updateHotelBookingScore(
  id: number,
  score: number | null,
): Promise<UpdateScoreResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  if (!Number.isInteger(id)) return { error: "badId" };

  let value: number | null = null;
  if (score != null) {
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 10) {
      return { error: "badScore" };
    }
    value = Math.round(score * 10) / 10;
  }

  await db.update(hotels).set({ bookingScore: value }).where(eq(hotels.id, id));
  revalidatePath("/[locale]/hotels", "page");
  return { ok: true, score: value };
}
