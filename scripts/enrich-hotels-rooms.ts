/**
 * Seeds each hotel's room list (name, size m², occupancy) from Booking.com via
 * the Apify "voyager/booking-scraper" actor — a one-time paid run (~$0.01 per
 * hotel: place-scraped + additional-details events). Writes straight to the
 * `rooms` table — room data is DB-managed and never lives in the seed JSON
 * (scripts/seed.ts snapshots it by hotel name across re-seeds, like the Places
 * enrichment).
 *
 * Usage (needs APIFY_TOKEN in .env.local):
 *   bun scripts/enrich-hotels-rooms.ts                 # dry-run: plan + cost estimate
 *   bun scripts/enrich-hotels-rooms.ts --yes           # hotels without rooms yet
 *   bun scripts/enrich-hotels-rooms.ts --dest BUS --yes
 *   bun scripts/enrich-hotels-rooms.ts --dest BUS --limit 2 --yes   # cheap probe
 *   bun scripts/enrich-hotels-rooms.ts --all --yes     # re-enrich everything
 *
 * Two fetch paths, matching what our DB stores per hotel:
 *   - direct property URLs (…/hotel/xx/slug.html) → ONE batched actor run;
 *   - search-results URLs → one search-mode run per hotel with maxItems:1
 *     (Booking's bot-wall blocks resolving these with a plain fetch).
 * The run ends with a match report; review ⚠ rows before trusting the data.
 *
 * Caveat: Booking renders the room table for a concrete stay, so a room type
 * with no availability on the probe dates may be missing — rerunning later
 * with different dates can fill gaps (existing rows are replaced per hotel).
 */
import { eq, sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import type { Localized } from "../db/schema";

const TOKEN = process.env.APIFY_TOKEN;
if (!TOKEN) throw new Error("APIFY_TOKEN is not set. Add it to .env.local");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Add it to .env.local");
const db = drizzle(neon(process.env.DATABASE_URL), { schema });

const { hotels, destinations, rooms } = schema;

const ACTOR = "voyager~booking-scraper";
const API = "https://api.apify.com/v2";
const COST_PER_HOTEL_USD = 0.01; // place-scraped + additional-details, free tier
const MAX_ROOMS_PER_HOTEL = 12;

const args = process.argv.slice(2);
const force = args.includes("--all");
const confirmed = args.includes("--yes");
const destIata = args[args.indexOf("--dest") + 1]?.toUpperCase();
if (args.includes("--dest") && !/^[A-Z]{3}$/.test(destIata ?? "")) {
  throw new Error("--dest expects a 3-letter IATA code, e.g. --dest BUS");
}
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
if (Number.isNaN(limit) || limit < 1) throw new Error("--limit expects a positive number");

// ── Target hotels ────────────────────────────────────────────────────────────

type Target = {
  id: number;
  name: string;
  dest: string;
  city: string;
  country: string;
  propertyUrl: string | null; // null → search mode
};

async function collectTargets(): Promise<Target[]> {
  const dests = await db.select().from(destinations);
  const out: Target[] = [];
  for (const d of dests) {
    if (destIata && d.iata !== destIata) continue;
    const rows = await db
      .select({
        id: hotels.id,
        name: hotels.name,
        bookingUrl: hotels.bookingUrl,
        roomCount: sql<number>`(select count(*)::int from rooms r where r.hotel_id = ${hotels.id})`,
      })
      .from(hotels)
      .where(eq(hotels.destinationId, d.id));
    for (const h of rows) {
      if (!force && h.roomCount > 0) continue;
      const isProperty = h.bookingUrl?.includes("/hotel/") ?? false;
      out.push({
        id: h.id,
        name: h.name,
        dest: d.iata,
        city: d.name.en ?? d.name.he ?? "",
        country: d.country.en ?? d.country.he ?? "",
        propertyUrl: isProperty ? h.bookingUrl!.split("?")[0] : null,
      });
    }
  }
  if (out.length <= limit) return out;
  // A capped run (the probe) should exercise BOTH fetch paths when it can.
  const direct = out.filter((t) => t.propertyUrl);
  const search = out.filter((t) => !t.propertyUrl);
  const take: Target[] = [];
  for (let i = 0; take.length < limit && (i < direct.length || i < search.length); i++) {
    if (i < direct.length && take.length < limit) take.push(direct[i]);
    if (i < search.length && take.length < limit) take.push(search[i]);
  }
  return take;
}

// ── Apify plumbing ───────────────────────────────────────────────────────────

/** Stay params: rooms only render for a concrete stay; ~1 month out, 2 nights. */
function stayInput() {
  const inDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const outDate = new Date(Date.now() + 32 * 86_400_000).toISOString().slice(0, 10);
  return {
    checkIn: inDate,
    checkOut: outDate,
    adults: 2,
    rooms: 1,
    currency: "USD",
    language: "en-us",
    extractAdditionalHotelData: true, // ← the flag that adds room offerings
  };
}

async function startRun(input: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${API}/acts/${ACTOR}/runs?token=${TOKEN}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`actor start ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { data: { id: string } };
  return json.data.id;
}

/** Poll until the run finishes; returns its dataset items. */
async function awaitRunItems(runId: string, timeoutMin: number): Promise<unknown[]> {
  const deadline = Date.now() + timeoutMin * 60_000;
  for (;;) {
    const res = await fetch(`${API}/actor-runs/${runId}?token=${TOKEN}`);
    if (!res.ok) throw new Error(`run poll ${res.status}`);
    const { data } = (await res.json()) as {
      data: { status: string; defaultDatasetId: string };
    };
    if (data.status === "SUCCEEDED") {
      const items = await fetch(
        `${API}/datasets/${data.defaultDatasetId}/items?token=${TOKEN}&clean=true`,
      );
      if (!items.ok) throw new Error(`dataset ${items.status}`);
      return (await items.json()) as unknown[];
    }
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(data.status)) {
      throw new Error(`run ${runId} ended ${data.status}`);
    }
    if (Date.now() > deadline) throw new Error(`run ${runId} still ${data.status} after ${timeoutMin}min`);
    await Bun.sleep(10_000);
  }
}

// ── Room extraction (tolerant: actor output fields vary by version) ──────────

type RawRoom = Record<string, unknown>;
type ExtractedRoom = { name: string; sizeSqm: number | null; persons: number | null };

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** "32 m²" / "344 ft²" hidden in any string field of the room object. */
function sizeFromStrings(room: RawRoom): number | null {
  const texts: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") texts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(room);
  for (const t of texts) {
    const sqm = t.match(/(\d+(?:[.,]\d+)?)\s*(?:m²|m2|sqm|square met)/i);
    if (sqm) return Math.round(Number.parseFloat(sqm[1].replace(",", ".")));
    const sqft = t.match(/(\d+(?:[.,]\d+)?)\s*(?:ft²|ft2|sq\.?\s*ft)/i);
    if (sqft) return Math.round(Number.parseFloat(sqft[1].replace(",", ".")) * 0.092903);
  }
  return null;
}

function extractRooms(item: RawRoom): ExtractedRoom[] {
  const lists = [item.roomOfferings, item.rooms, item.roomTypes].filter(Array.isArray);
  const raw = (lists[0] ?? []) as RawRoom[];
  const seen = new Set<string>();
  const out: ExtractedRoom[] = [];
  for (const r of raw) {
    const name = str(r.name) ?? str(r.roomType) ?? str(r.title) ?? str(r.type);
    if (!name) continue;
    const key = name.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    const sizeSqm =
      num(r.size) ?? num(r.roomSize) ?? num(r.sizeSqm) ?? num(r.area) ?? sizeFromStrings(r);
    const persons =
      num(r.persons) ?? num(r.maxPersons) ?? num(r.occupancy) ?? num(r.maxOccupancy) ?? num(r.guests);
    out.push({
      name,
      sizeSqm: sizeSqm !== null ? Math.round(sizeSqm) : null,
      persons: persons !== null ? Math.round(persons) : null,
    });
    if (out.length >= MAX_ROOMS_PER_HOTEL) break;
  }
  return out;
}

/** Occupancy label + icon following the existing curated-rooms conventions. */
function occupancyOf(persons: number | null, name: string): { occ: Localized | null; icon: string } {
  const familyish = persons !== null && persons >= 3;
  const icon = familyish || /family|triple|quadruple|quad\b/i.test(name) ? "👨‍👩‍👧" : "🛏";
  if (persons === null) return { occ: null, icon };
  const occ: Localized =
    persons === 1
      ? { he: "יחיד", en: "Single" }
      : persons === 2
        ? { he: "זוגי", en: "Double" }
        : persons === 3
          ? { he: "שלישיה", en: "Triple" }
          : persons === 4
            ? { he: "רביעיה", en: "Quadruple" }
            : { he: `עד ${persons} אורחים`, en: `Up to ${persons} guests` };
  return { occ, icon };
}

/** Same loose similarity check the Places enrichment uses to flag mismatches. */
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

/** Booking property slug ("/hotel/ge/sheraton-batumi") for URL-based matching. */
function slugOf(url: string | null | undefined): string | null {
  const m = typeof url === "string" ? url.match(/\/hotel\/[a-z]{2}\/[^/.?#]+/) : null;
  return m ? m[0] : null;
}

// ── Load ─────────────────────────────────────────────────────────────────────

async function writeRooms(target: Target, extracted: ExtractedRoom[]): Promise<void> {
  // Replace-all semantics: this run is the authoritative source per hotel.
  await db.delete(rooms).where(eq(rooms.hotelId, target.id));
  if (!extracted.length) return;
  await db.insert(rooms).values(
    extracted.map((r, i) => {
      const { occ, icon } = occupancyOf(r.persons, r.name);
      return {
        hotelId: target.id,
        name: r.name.slice(0, 160),
        icon,
        sizeSqm: r.sizeSqm,
        occupancy: occ,
        sortOrder: i,
      };
    }),
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

type Report = { dest: string; ours: string; matched: string; roomCount: number; flag: string };

async function main() {
  const targets = await collectTargets();
  const direct = targets.filter((t) => t.propertyUrl);
  const search = targets.filter((t) => !t.propertyUrl);
  console.log(
    `Targets: ${targets.length} hotels (${direct.length} direct URLs → 1 batch run, ` +
      `${search.length} search-mode runs). Estimated cost ≈ $${(targets.length * COST_PER_HOTEL_USD).toFixed(2)}.`,
  );
  if (!targets.length) return;
  if (!confirmed) {
    console.log("\nDry run (no charges made). Re-run with --yes to start the Apify runs.");
    return;
  }

  const report: Report[] = [];
  const stay = stayInput();

  // 1) One batched run for every hotel with a direct property URL.
  if (direct.length) {
    console.log(`\nStarting batch run for ${direct.length} property URLs…`);
    const runId = await startRun({
      startUrls: direct.map((t) => ({ url: t.propertyUrl })),
      maxItems: direct.length,
      ...stay,
    });
    console.log(`  run ${runId} — polling`);
    const items = (await awaitRunItems(runId, 45)) as RawRoom[];
    console.log(`  run done: ${items.length} items`);

    const bySlug = new Map<string, RawRoom>();
    for (const item of items) {
      const s = slugOf(str(item.url));
      if (s) bySlug.set(s, item);
    }
    for (const t of direct) {
      const item = bySlug.get(slugOf(t.propertyUrl) ?? "");
      if (!item) {
        report.push({ dest: t.dest, ours: t.name, matched: "(no item)", roomCount: 0, flag: "⚠ NO DATA" });
        continue;
      }
      const extracted = extractRooms(item);
      await writeRooms(t, extracted);
      report.push({
        dest: t.dest,
        ours: t.name,
        matched: str(item.name) ?? "?",
        roomCount: extracted.length,
        flag: extracted.length ? "ok" : "⚠ 0 ROOMS",
      });
      console.log(`  ${extracted.length ? "✓" : "⚠"} ${t.name}: ${extracted.length} rooms`);
    }
  }

  // 2) One search-mode run per hotel without a property URL (maxItems: 1).
  //    Small concurrency to finish ~170 runs in reasonable time.
  if (search.length) {
    console.log(`\nStarting ${search.length} search-mode runs (concurrency 5)…`);
    let cursor = 0;
    const worker = async () => {
      for (;;) {
        const i = cursor++;
        if (i >= search.length) return;
        const t = search[i];
        try {
          const runId = await startRun({
            search: `${t.name} ${t.city}`,
            maxItems: 1,
            ...stay,
          });
          const items = (await awaitRunItems(runId, 20)) as RawRoom[];
          const item = items[0];
          const matchedName = item ? (str(item.name) ?? "?") : "(no result)";
          if (!item) {
            report.push({ dest: t.dest, ours: t.name, matched: matchedName, roomCount: 0, flag: "⚠ NO MATCH" });
            console.log(`  — ${t.name}: no result`);
            continue;
          }
          const weak = !looksAlike(t.name, matchedName);
          const extracted = extractRooms(item);
          await writeRooms(t, extracted);
          report.push({
            dest: t.dest,
            ours: t.name,
            matched: matchedName,
            roomCount: extracted.length,
            flag: weak ? "⚠ CHECK" : extracted.length ? "ok" : "⚠ 0 ROOMS",
          });
          console.log(`  ${weak ? "⚠" : "✓"} ${t.name} → ${matchedName}: ${extracted.length} rooms`);
        } catch (err) {
          report.push({ dest: t.dest, ours: t.name, matched: String(err).slice(0, 80), roomCount: 0, flag: "✗ ERROR" });
          console.error(`  ✗ ${t.name}: ${err}`);
        }
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
  }

  console.log(`\n──────── match report ────────`);
  for (const r of report.filter((r) => r.flag !== "ok")) {
    console.log(`${r.flag}  [${r.dest}] ${r.ours}  →  ${r.matched} (${r.roomCount} rooms)`);
  }
  const ok = report.filter((r) => r.flag === "ok").length;
  const withRooms = report.filter((r) => r.roomCount > 0).length;
  console.log(
    `\n${report.length} processed: ${withRooms} with rooms, ${ok} clean, ` +
      `${report.length - ok} flagged (review ⚠/✗ above; fix by rerunning with --dest/--all).`,
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
