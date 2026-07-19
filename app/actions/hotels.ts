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
  type BoardCode,
  type HotelFeatureValue,
  type Localized,
} from "@/db/schema";
import { can } from "@/lib/auth";
import { backendFetch, backendUrl } from "@/lib/ai/backend";

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

// ── In-app "add a hotel to an existing destination" (editors) ────────────────
// The Python backend does the enrichment (Apify + Google Places + OSRM
// distances) and returns a draft; Next writes the hotel here only after the
// agent's review. See components/hotels/add-hotel-dialog.tsx.

const FEATURES: readonly HotelFeatureValue[] = [
  "pool-in",
  "pool-out",
  "casino",
  "casino-near",
  "waterpark",
  "spa",
  "outside-center",
];
const BOARDS: readonly BoardCode[] = ["bb", "hb", "fb"];

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
