"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  destinations,
  hotels,
  hotelDistances,
  hotelFeatures,
  rooms,
  boardCode,
  hotelFeature,
  type BoardCode,
  type HotelFeatureValue,
  type Localized,
} from "@/db/schema";
import { can } from "@/lib/auth";
import { backendFetch, backendUrl } from "@/lib/ai/backend";

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

// ── In-app "add a hotel to an existing destination" (editors) ────────────────
// The Python backend does the enrichment (Apify + Google Places + OSRM
// distances) and returns a draft; Next writes the hotel here only after the
// agent's review. See components/hotels/add-hotel-dialog.tsx.
// (BOARDS / FEATURES are declared once above, from the enums.)

export type EnrichRoom = {
  name: string;
  icon?: string | null;
  sizeSqm?: number | null;
  occupancy?: Localized | null;
  facilities?: string[] | null;
  photos?: string[] | null;
  photoUrl?: string | null;
  sortOrder?: number;
};

export type EnrichGoogle = {
  placeId?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  address?: string | null;
  websiteUrl?: string | null;
  photoUrl?: string | null;
  googleMapsUrl?: string | null;
};

/** The reviewable draft (mirrors the backend's `draft`). */
export type EnrichDraft = {
  name: string;
  bookingScore?: number | null;
  stars?: number | null;
  bookingUrl?: string | null;
  features: HotelFeatureValue[];
  boards: BoardCode[];
  distances: {
    key: string;
    meters: number | null;
    walkMinutes: number | null;
    rideMinutes: number | null;
  }[];
  rooms: EnrichRoom[];
  bookingImage?: string | null;
  google?: EnrichGoogle | null;
};

export type EnrichJob = {
  status: "running" | "done" | "error";
  steps: Record<string, string>;
  draft?: EnrichDraft | null;
  error?: string | null;
};

type StartResult =
  | { jobId: string }
  | { error: "forbidden" | "offline" | "notConfigured" | "invalid" | "failed" };

/** Kick off the backend enrichment job for a Booking property URL. */
export async function startHotelEnrichAction(
  destIata: string,
  bookingUrl: string,
): Promise<StartResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  if (!backendUrl()) return { error: "offline" };
  const url = bookingUrl.trim();
  if (!/\/hotel\//.test(url)) return { error: "invalid" };

  const dest = await db.query.destinations.findFirst({
    where: eq(destinations.iata, destIata.toUpperCase()),
    columns: { landmarkGeo: true },
  });
  if (!dest) return { error: "invalid" };

  try {
    const res = await backendFetch("/hotels/enrich", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingUrl: url, landmarks: dest.landmarkGeo?.points ?? [] }),
    });
    if (!res.ok) return { error: res.status === 503 ? "notConfigured" : "failed" };
    const { jobId } = (await res.json()) as { jobId: string };
    return { jobId };
  } catch {
    return { error: "offline" };
  }
}

/** Poll the backend job for progress + the finished draft. */
export async function hotelEnrichStatusAction(
  jobId: string,
): Promise<EnrichJob | { error: "forbidden" | "failed" }> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  try {
    const res = await backendFetch(`/hotels/enrich/${encodeURIComponent(jobId)}`);
    if (!res.ok) return { error: "failed" };
    return (await res.json()) as EnrichJob;
  } catch {
    return { error: "failed" };
  }
}

export type CreateResult =
  | { ok: true; hotelId: number }
  | { error: "forbidden" | "invalid" | "offline" };

/** Insert the reviewed hotel (+ features, distances, rooms) into the destination. */
export async function createEnrichedHotelAction(
  destIata: string,
  draft: EnrichDraft,
): Promise<CreateResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  const name = (draft.name ?? "").trim().slice(0, 200);
  if (!name) return { error: "invalid" };

  const dest = await db.query.destinations.findFirst({
    where: eq(destinations.iata, destIata.toUpperCase()),
    columns: { id: true },
    with: { landmarks: { columns: { id: true, key: true } } },
  });
  if (!dest) return { error: "invalid" };
  const landmarkId = new Map(dest.landmarks.map((l) => [l.key, l.id]));

  const feats = [...new Set((draft.features ?? []).filter((f) => FEATURES.includes(f)))];
  const boards = [...new Set((draft.boards ?? []).filter((b) => BOARDS.includes(b)))];
  const g = draft.google ?? null;

  let hotelId: number | null = null;
  try {
    const [maxRow] = await db
      .select({ max: sql<number>`coalesce(max(${hotels.sortOrder}), 0)` })
      .from(hotels)
      .where(eq(hotels.destinationId, dest.id));

    const [row] = await db
      .insert(hotels)
      .values({
        destinationId: dest.id,
        name,
        stars: typeof draft.stars === "number" ? draft.stars : null,
        boards,
        bookingScore: draft.bookingScore ?? null,
        bookingUrl: draft.bookingUrl ?? null,
        googleMapsUrl: g?.googleMapsUrl ?? null,
        googlePlaceId: g?.placeId ?? null,
        googleRating: g?.rating ?? null,
        googleReviewCount: g?.reviewCount ?? null,
        address: g?.address ?? null,
        websiteUrl: g?.websiteUrl ?? null,
        photoUrl: g?.photoUrl ?? draft.bookingImage ?? null,
        roomsNote: draft.rooms?.length ? { he: "המידע לפי Booking", en: "Info per Booking" } : null,
        placesUpdatedAt: g ? new Date() : null,
        sortOrder: Number(maxRow.max) + 1,
      })
      .returning({ id: hotels.id });
    hotelId = row.id;

    if (feats.length) {
      await db.insert(hotelFeatures).values(feats.map((feature) => ({ hotelId: row.id, feature })));
    }
    const dists = (draft.distances ?? []).filter((d) => landmarkId.has(d.key));
    if (dists.length) {
      await db.insert(hotelDistances).values(
        dists.map((d) => ({
          hotelId: row.id,
          landmarkId: landmarkId.get(d.key)!,
          meters: d.meters,
          walkMinutes: d.walkMinutes,
          rideMinutes: d.rideMinutes,
        })),
      );
    }
    const rms = draft.rooms ?? [];
    if (rms.length) {
      await db.insert(rooms).values(
        rms.map((r, i) => ({
          hotelId: row.id,
          name: r.name.slice(0, 160),
          icon: r.icon ?? null,
          sizeSqm: r.sizeSqm ?? null,
          occupancy: r.occupancy ?? null,
          facilities: r.facilities ?? null,
          photos: r.photos ?? null,
          photoUrl: r.photoUrl ?? r.photos?.[0] ?? null,
          sortOrder: r.sortOrder ?? i,
        })),
      );
    }
    revalidatePath("/[locale]/hotels", "page");
    return { ok: true, hotelId: row.id };
  } catch {
    // Compensate: drop the partial hotel (cascade clears any children written).
    if (hotelId !== null) {
      try {
        await db.delete(hotels).where(eq(hotels.id, hotelId));
      } catch {
        /* best-effort rollback */
      }
    }
    return { error: "offline" };
  }
}
