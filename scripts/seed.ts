/**
 * Seeds Neon from the legacy HTML. Idempotent: destinations/landmarks are
 * upserted; a destination's hotels are replaced wholesale on each run (cascades
 * clean up features/distances).
 *
 * Run with: `bun run seed` (Bun auto-loads .env.local).
 */
import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { extractSeed } from "./extract";

const {
  destinations,
  landmarks,
  hotels,
  hotelFeatures,
  hotelTags,
  hotelDistances,
  rooms,
} = schema;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local");
}
const db = drizzle(neon(process.env.DATABASE_URL), { schema });

async function main() {
  const data = extractSeed();
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

    // Replace hotels for this destination (cascade removes old features/distances).
    await db.delete(hotels).where(eq(hotels.destinationId, dest.id));

    for (const h of d.hotels) {
      const [hotel] = await db
        .insert(hotels)
        .values({
          destinationId: dest.id,
          name: h.name,
          stars: h.stars,
          tier: h.tier,
          boards: h.boards,
          bookingScore: h.bookingScore,
          googleMapsUrl: h.googleMapsUrl,
          bookingUrl: h.bookingUrl,
          roomsNote: h.roomsNote,
          sortOrder: h.sortOrder,
        })
        .returning();
      hotelTotal++;

      if (h.features.length) {
        await db
          .insert(hotelFeatures)
          .values(h.features.map((feature) => ({ hotelId: hotel.id, feature })));
      }

      if (h.tags.length) {
        await db
          .insert(hotelTags)
          .values(h.tags.map((tag) => ({ hotelId: hotel.id, tag })));
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

      if (h.rooms.length) {
        await db.insert(rooms).values(
          h.rooms.map((r) => ({
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
