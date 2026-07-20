"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  hotels,
  hotelFeatures,
  boardCode,
  hotelFeature,
  type BoardCode,
  type HotelFeatureValue,
} from "@/db/schema";
import { can } from "@/lib/auth";

/**
 * Editor+ update of a hotel's curated fields (name, stars, Booking score, board
 * basis, amenities, Booking + website links). Address / Google rating /
 * distances are intentionally NOT editable — they're auto-managed. The UI only
 * shows the control to permitted users; this re-check is the security boundary.
 *
 * Writes to the DB only — a later `bun run seed` resets these to the seed, so
 * lasting changes should also be folded back into the seed.
 */

export type HotelPatch = {
  name: string;
  stars: number | null;
  bookingScore: number | null;
  boards: BoardCode[];
  features: HotelFeatureValue[];
  bookingUrl: string | null;
  websiteUrl: string | null;
};
export type UpdateHotelResult = { ok: true } | { error: "forbidden" | "invalid" | "offline" };

const BOARDS: readonly string[] = boardCode.enumValues;
const FEATURES: readonly string[] = hotelFeature.enumValues;

/** Trim a URL field to null when empty; only keep http(s) links. */
function cleanUrl(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().slice(0, 2048);
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : null;
}

export async function updateHotelAction(
  id: number,
  patch: HotelPatch,
): Promise<UpdateHotelResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  if (!Number.isInteger(id)) return { error: "invalid" };

  const name = (patch?.name ?? "").trim().slice(0, 200);
  if (!name) return { error: "invalid" };

  let stars: number | null = null;
  if (patch.stars != null) {
    if (!Number.isInteger(patch.stars) || patch.stars < 1 || patch.stars > 5) {
      return { error: "invalid" };
    }
    stars = patch.stars;
  }

  let bookingScore: number | null = null;
  if (patch.bookingScore != null) {
    if (!Number.isFinite(patch.bookingScore) || patch.bookingScore < 0 || patch.bookingScore > 10) {
      return { error: "invalid" };
    }
    bookingScore = Math.round(patch.bookingScore * 10) / 10;
  }

  const boards = (Array.isArray(patch.boards) ? patch.boards : []).filter((b) =>
    BOARDS.includes(b),
  ) as BoardCode[];
  const features = [
    ...new Set(
      (Array.isArray(patch.features) ? patch.features : []).filter((f) => FEATURES.includes(f)),
    ),
  ] as HotelFeatureValue[];

  try {
    const rows = await db
      .update(hotels)
      .set({
        name,
        stars,
        bookingScore,
        boards,
        bookingUrl: cleanUrl(patch.bookingUrl),
        websiteUrl: cleanUrl(patch.websiteUrl),
      })
      .where(eq(hotels.id, id))
      .returning({ id: hotels.id });
    if (rows.length === 0) return { error: "invalid" };

    // Replace the amenity rows (join table).
    await db.delete(hotelFeatures).where(eq(hotelFeatures.hotelId, id));
    if (features.length) {
      await db.insert(hotelFeatures).values(features.map((feature) => ({ hotelId: id, feature })));
    }

    revalidatePath("/[locale]/hotels", "page");
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}
