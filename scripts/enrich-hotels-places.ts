/**
 * Enriches hotels from the Google Places API (New): Google rating + review
 * count, formatted address, official website, and a photo URL. Writes straight
 * to the DB — this data is DB-managed and never lives in the seed JSON
 * (scripts/seed.ts preserves it across re-seeds; the backend's /cron/places
 * refreshes rating/count weekly).
 *
 * Usage (needs GOOGLE_PLACES_API_KEY in .env.local):
 *   bun scripts/enrich-hotels-places.ts             # hotels not yet enriched
 *   bun scripts/enrich-hotels-places.ts --dest BUS  # one destination only
 *   bun scripts/enrich-hotels-places.ts --all       # force re-enrich everything
 *
 * Matching is by "<hotel name>, <city>, <country>" Text Search — the top
 * result. That can mismatch (chains, similarly-named properties), so the run
 * ends with a match report: review the ⚠ rows, then fix any bad match by
 * clearing/correcting the row in the DB and rerunning with a better name.
 */
import { and, eq, isNull } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) throw new Error("GOOGLE_PLACES_API_KEY is not set. Add it to .env.local");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Add it to .env.local");
const db = drizzle(neon(process.env.DATABASE_URL), { schema });

const { hotels, destinations } = schema;

const args = process.argv.slice(2);
const force = args.includes("--all");
const destIata = args[args.indexOf("--dest") + 1]?.toUpperCase();
if (args.includes("--dest") && !/^[A-Z]{3}$/.test(destIata ?? "")) {
  throw new Error("--dest expects a 3-letter IATA code, e.g. --dest BUS");
}

type Place = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  photos?: { name: string }[];
};

/** Top Text Search result for the query, or null when Google finds nothing. */
async function searchPlace(query: string): Promise<Place | null> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": API_KEY!,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.photos",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "en" }),
  });
  if (!res.ok) throw new Error(`searchText ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { places?: Place[] };
  return json.places?.[0] ?? null;
}

/** Resolve a photo resource to its key-free googleusercontent URL. */
async function resolvePhotoUrl(photoName: string): Promise<string | null> {
  const res = await fetch(
    `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&skipHttpRedirect=true&key=${API_KEY}`,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { photoUri?: string };
  return json.photoUri ?? null;
}

/** Loose name-similarity check to flag likely mismatches for the report. */
function looksAlike(ours: string, theirs: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/hotel|the|by|and|&|,|-|'|’/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const a = norm(ours);
  const b = new Set(norm(theirs));
  const hits = a.filter((w) => b.has(w)).length;
  return a.length === 0 || hits / a.length >= 0.5;
}

const dests = await db.select().from(destinations);
const report: { dest: string; ours: string; matched: string; flag: string }[] = [];
let enriched = 0;
let missed = 0;
let skipped = 0;

for (const d of dests) {
  if (destIata && d.iata !== destIata) continue;
  const rows = await db
    .select()
    .from(hotels)
    .where(
      force
        ? eq(hotels.destinationId, d.id)
        : and(eq(hotels.destinationId, d.id), isNull(hotels.googlePlaceId)),
    );
  if (rows.length === 0) continue;
  console.log(`\n${d.iata} ${d.name.en}: ${rows.length} hotels to enrich`);

  for (const h of rows) {
    const query = `${h.name}, ${d.name.en}, ${d.country.en}`;
    let place: Place | null;
    try {
      place = await searchPlace(query);
    } catch (err) {
      console.error(`  ✗ ${h.name}: ${err}`);
      missed++;
      continue;
    }
    if (!place) {
      console.log(`  — ${h.name}: no Google match`);
      report.push({ dest: d.iata, ours: h.name, matched: "(no match)", flag: "⚠ NO MATCH" });
      missed++;
      await Bun.sleep(150);
      continue;
    }

    const matchedName = place.displayName?.text ?? "";
    const weak = !looksAlike(h.name, matchedName);
    const photoUrl = place.photos?.[0]?.name ? await resolvePhotoUrl(place.photos[0].name) : null;

    await db
      .update(hotels)
      .set({
        googlePlaceId: place.id,
        googleRating: place.rating ?? null,
        googleReviewCount: place.userRatingCount ?? null,
        address: place.formattedAddress ?? null,
        websiteUrl: place.websiteUri ?? null,
        photoUrl,
        placesUpdatedAt: new Date(),
      })
      .where(eq(hotels.id, h.id));
    enriched++;
    report.push({
      dest: d.iata,
      ours: h.name,
      matched: `${matchedName} — ${place.formattedAddress ?? "?"}`,
      flag: weak ? "⚠ CHECK" : "ok",
    });
    console.log(
      `  ${weak ? "⚠" : "✓"} ${h.name} → ${matchedName} (★${place.rating ?? "—"}, ${place.userRatingCount ?? 0} reviews${photoUrl ? ", photo" : ", NO photo"}${place.websiteUri ? "" : ", NO website"})`,
    );
    await Bun.sleep(150); // stay friendly to per-minute quotas
  }
}

console.log(`\n──────── match report ────────`);
for (const r of report.filter((r) => r.flag !== "ok")) {
  console.log(`${r.flag}  [${r.dest}] ${r.ours}  →  ${r.matched}`);
}
const weakCount = report.filter((r) => r.flag !== "ok").length;
console.log(
  `\nEnriched ${enriched}, no-match ${missed}, skipped ${skipped}. ${weakCount} row(s) need review (⚠ above).`,
);
process.exit(0);
