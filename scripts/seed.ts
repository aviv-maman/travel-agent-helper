/**
 * Seeds Neon from data/seed.json (the legacy-HTML export) plus the add-on
 * destinations in data/destinations/ (built by the add-destination skill).
 * Idempotent: destinations/landmarks are upserted; a destination's hotels are
 * replaced wholesale on each run (cascades clean up features/distances) —
 * except the DB-managed enrichments, which are snapshotted by hotel name and
 * re-applied: the Google Places columns and the `rooms` rows (filled by
 * scripts/enrich-hotels-{places,rooms}.ts, never part of the seed JSON).
 *
 * Run with: `bun run seed` (Bun auto-loads .env.local).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import type { SeedDestination } from "./extract";
import { EXTRA_DESTINATIONS } from "../data/destinations";

const SEED_FILE = join(process.cwd(), "data", "seed.json");

const { destinations, landmarks, hotels, hotelFeatures, hotelTags, hotelDistances, rooms } = schema;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local");
}
const db = drizzle(neon(process.env.DATABASE_URL), { schema });

async function main() {
  const legacy = JSON.parse(readFileSync(SEED_FILE, "utf8")) as SeedDestination[];
  const data = [...legacy, ...EXTRA_DESTINATIONS];
  let hotelTotal = 0;

  for (const d of data) {
    const [dest] = await db
      .insert(destinations)
      .values({
        iata: d.iata,
        name: d.name,
        country: d.country,
        countryCode: d.countryCode,
        info: d.info,
        sortOrder: d.sortOrder,
      })
      .onConflictDoUpdate({
        target: destinations.iata,
        set: {
          name: d.name,
          country: d.country,
          countryCode: d.countryCode,
          info: d.info,
          sortOrder: d.sortOrder,
        },
      })
      .returning();

    // Upsert landmarks, build key → id map.
    const landmarkId = new Map<string, number>();
    for (const lm of d.landmarks) {
      const [row] = await db
        .insert(landmarks)
        .values({
          destinationId: dest.id,
          key: lm.key,
          name: lm.name,
        })
        .onConflictDoUpdate({
          target: [landmarks.destinationId, landmarks.key],
          set: { name: lm.name },
        })
        .returning();
      landmarkId.set(lm.key, row.id);
    }

    // The Google Places enrichment (rating, address, website, photo…) is
    // DB-managed — it never lives in the seed JSON. Snapshot it by hotel name
    // so the wholesale replace below doesn't wipe it; a renamed hotel simply
    // loses enrichment until the next enrich-hotels-places.ts run.
    const enriched = new Map(
      (
        await db
          .select({
            name: hotels.name,
            googlePlaceId: hotels.googlePlaceId,
            googleRating: hotels.googleRating,
            googleReviewCount: hotels.googleReviewCount,
            address: hotels.address,
            websiteUrl: hotels.websiteUrl,
            photoUrl: hotels.photoUrl,
            placesUpdatedAt: hotels.placesUpdatedAt,
          })
          .from(hotels)
          .where(eq(hotels.destinationId, dest.id))
      )
        .filter((h) => h.googlePlaceId !== null)
        .map(({ name, ...fields }) => [name, fields]),
    );

    // Room lists are DB-managed too (scripts/enrich-hotels-rooms.ts) — snapshot
    // them by hotel name so the wholesale replace below doesn't wipe them. A
    // snapshot takes precedence over seed-file rooms (the seed arrays are the
    // pre-enrichment legacy and are kept empty).
    const roomRows = await db
      .select({
        hotelName: hotels.name,
        name: rooms.name,
        icon: rooms.icon,
        sizeSqm: rooms.sizeSqm,
        occupancy: rooms.occupancy,
        sortOrder: rooms.sortOrder,
      })
      .from(rooms)
      .innerJoin(hotels, eq(rooms.hotelId, hotels.id))
      .where(eq(hotels.destinationId, dest.id));
    const savedRooms = new Map<string, Omit<(typeof roomRows)[number], "hotelName">[]>();
    for (const { hotelName, ...r } of roomRows) {
      const list = savedRooms.get(hotelName) ?? [];
      list.push(r);
      savedRooms.set(hotelName, list);
    }

    // Replace hotels for this destination (cascade removes old features/distances).
    await db.delete(hotels).where(eq(hotels.destinationId, dest.id));

    for (const h of d.hotels) {
      const [hotel] = await db
        .insert(hotels)
        .values({
          destinationId: dest.id,
          name: h.name,
          stars: h.stars,
          boards: h.boards,
          bookingScore: h.bookingScore,
          googleMapsUrl: h.googleMapsUrl,
          bookingUrl: h.bookingUrl,
          roomsNote: h.roomsNote,
          sortOrder: h.sortOrder,
          ...(enriched.get(h.name) ?? {}),
        })
        .returning();
      hotelTotal++;

      if (h.features.length) {
        await db
          .insert(hotelFeatures)
          .values(h.features.map((feature) => ({ hotelId: hotel.id, feature })));
      }

      if (h.tags.length) {
        await db.insert(hotelTags).values(h.tags.map((tag) => ({ hotelId: hotel.id, tag })));
      }

      const dists = h.distances
        .filter((dist) => landmarkId.has(dist.landmarkKey))
        .map((dist) => ({
          hotelId: hotel.id,
          landmarkId: landmarkId.get(dist.landmarkKey)!,
          meters: dist.meters,
          walkMinutes: dist.walkMinutes,
          rideMinutes: dist.rideMinutes,
        }));
      if (dists.length) await db.insert(hotelDistances).values(dists);

      const hotelRooms = savedRooms.get(h.name) ?? h.rooms;
      if (hotelRooms.length) {
        await db.insert(rooms).values(
          hotelRooms.map((r) => ({
            hotelId: hotel.id,
            name: r.name,
            icon: r.icon,
            sizeSqm: r.sizeSqm,
            occupancy: r.occupancy,
            sortOrder: r.sortOrder,
          })),
        );
      }
    }

    console.log(`  ${d.iata} ${d.name.en}: ${d.hotels.length} hotels`);
  }

  console.log(`\nSeeded ${data.length} destinations, ${hotelTotal} hotels.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
