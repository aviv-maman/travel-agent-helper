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
 * The actor only accepts property-page startUrls (its `search` input is
 * destination-only, and searchresults startUrls die in its destination
 * resolver — both probed live). Hotels stored with search-results links must
 * therefore be pre-resolved to property URLs: a Playwright page drives
 * Booking's own autocomplete + searchresults fetches (in-page, past the
 * bot-wall) and emits a mapping file, passed here as
 * `--resolved <path.jsonl>` ([{id, url, label, score}] lines; score < 0.5 or
 * a null url stays unresolved and is reported, not sent). Everything then
 * goes through ONE batched actor run.
 * The run ends with a match report; review ⚠ rows before trusting the data.
 *
 * Room source (probed live): roomOfferings.roomDetail.property.roomsDetails —
 * the FULL room catalog with roomSizeM2 + occupancy.maxPersons, independent of
 * availability. Fallback: the `rooms` availability table (sizes hide in
 * "NNN feet²" facility strings; only rooms bookable for the stay dates appear).
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
const destIata = args.includes("--dest") ? args[args.indexOf("--dest") + 1]?.toUpperCase() : undefined;
if (args.includes("--dest") && !/^[A-Z]{3}$/.test(destIata ?? "")) {
  throw new Error("--dest expects a 3-letter IATA code, e.g. --dest BUS");
}
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
if (Number.isNaN(limit) || limit < 1) throw new Error("--limit expects a positive number");
const resolvedPath = args.includes("--resolved") ? args[args.indexOf("--resolved") + 1] : null;
// Repair mode: hotels that end this run unresolved/skipped get their room rows
// DELETED (used to purge rows a previous bad match wrote; a no-op when empty).
const clearUnmatched = args.includes("--clear-unmatched");
// Reprocess a stored Apify dataset instead of starting a paid run — datasets
// from previous runs persist for days and re-reading them is free.
const fromDataset = args.includes("--from-dataset")
  ? args[args.indexOf("--from-dataset") + 1]
  : null;
// Room-photo pilot gate: comma-separated slug/name substrings whose hotels get
// photoUrl stored ("all" = everyone). Facilities are extracted for everyone.
const photoHotels = args.includes("--photo-hotels")
  ? (args[args.indexOf("--photo-hotels") + 1] ?? "").toLowerCase().split(",").filter(Boolean)
  : [];
function wantsPhotos(t: Target): boolean {
  if (photoHotels.includes("all")) return true;
  const hay = `${t.name} ${slugOf(t.propertyUrl) ?? ""}`.toLowerCase();
  return photoHotels.some((p) => hay.includes(p));
}

/** hotelId → resolved property URL (score ≥ 0.5 only), from the resolver. */
async function loadResolved(): Promise<Map<number, { url: string; label: string | null }>> {
  const map = new Map<number, { url: string; label: string | null }>();
  if (!resolvedPath) return map;
  const text = await Bun.file(resolvedPath).text();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    for (const r of JSON.parse(line) as { id: number; url: string | null; label: string | null; score: number }[]) {
      if (r.url && r.score >= 0.5) map.set(r.id, { url: r.url, label: r.label });
    }
  }
  return map;
}

// ── Target hotels ────────────────────────────────────────────────────────────

type Target = {
  id: number;
  name: string;
  dest: string;
  city: string;
  country: string;
  propertyUrl: string | null; // null → search-URL mode
  searchUrl: string | null; // the stored searchresults.html?ss=… link
};

async function collectTargets(): Promise<Target[]> {
  const resolved = await loadResolved();
  const dests = await db.select().from(destinations);
  const out: Target[] = [];
  for (const d of dests) {
    if (destIata && d.iata !== destIata) continue;
    const rows = await db
      .select({
        id: hotels.id,
        name: hotels.name,
        bookingUrl: hotels.bookingUrl,
        // NOTE: the column must be qualified by hand — `${hotels.id}` renders as
        // bare "id" inside the subquery, which binds to rooms' own id column
        // (r.hotel_id = r.id ≈ always 0) and silently disables the filter.
        roomCount: sql<number>`(select count(*)::int from rooms r where r.hotel_id = "hotels"."id")`,
      })
      .from(hotels)
      .where(eq(hotels.destinationId, d.id));
    for (const h of rows) {
      if (!force && h.roomCount > 0) continue;
      const isProperty = h.bookingUrl?.includes("/hotel/") ?? false;
      // The resolver map wins over a stored direct URL: entries are verified
      // connector URLs, and a stored URL can point at the wrong property
      // (caught live: Leonardo Boutique M Square stored the flagship Leonardo).
      const viaResolver = resolved.get(h.id);
      out.push({
        id: h.id,
        name: h.name,
        dest: d.iata,
        city: d.name.en ?? d.name.he ?? "",
        country: d.country.en ?? d.country.he ?? "",
        propertyUrl: viaResolver?.url ?? (isProperty ? h.bookingUrl!.split("?")[0] : null),
        searchUrl: !isProperty && !viaResolver ? (h.bookingUrl ?? null) : null,
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
type ExtractedRoom = {
  name: string;
  sizeSqm: number | null;
  persons: number | null;
  facilities: string[] | null;
  /** All room photos (cf.bstatic.com URLs); photos[0] is the cover. */
  photos: string[] | null;
};

const MAX_PHOTOS_PER_ROOM = 10;

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

/** "32 m²" / "258 feet²" hidden in any string field of the room object. */
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
    const sqft = t.match(/(\d+(?:[.,]\d+)?)\s*(?:ft²|ft2|feet²|feet2|sq\.?\s*(?:ft|feet))/i);
    if (sqft) return Math.round(Number.parseFloat(sqft[1].replace(",", ".")) * 0.092903);
  }
  return null;
}

function extractRooms(item: RawRoom, withPhotos: boolean): ExtractedRoom[] {
  const seen = new Set<string>();
  const out: ExtractedRoom[] = [];
  const push = (
    name: string | null,
    sizeSqm: number | null,
    persons: number | null,
    facilities: string[] | null = null,
    photos: string[] | null = null,
  ) => {
    if (!name || out.length >= MAX_ROOMS_PER_HOTEL) return;
    const key = name.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      name,
      sizeSqm: sizeSqm !== null ? Math.round(sizeSqm) : null,
      persons: persons !== null ? Math.round(persons) : null,
      facilities: facilities?.length ? facilities : null,
      photos: photos?.length ? photos : null,
    });
  };

  // Preferred: the full room catalog (independent of stay-date availability),
  // with sizes already in m² — probed live on a real property page. Its sibling
  // highlightsForAllRooms carries Booking's compact per-room facility chips
  // ("Minibar", "City view", …), joined by room id; roomPhotos are CDN paths.
  const offerings = item.roomOfferings as RawRoom | undefined;
  const roomDetail = offerings?.roomDetail as RawRoom | undefined;
  const property = roomDetail?.property as RawRoom | undefined;
  const catalog = property?.roomsDetails;
  const highlightsByRoom = new Map<number, string[]>();
  for (const h of (Array.isArray(roomDetail?.highlightsForAllRooms)
    ? roomDetail!.highlightsForAllRooms
    : []) as RawRoom[]) {
    const id = num(h.roomId);
    const names = (Array.isArray(h.roomHighlights) ? (h.roomHighlights as RawRoom[]) : [])
      .map((x) => str(x.name))
      .filter((n): n is string => n !== null);
    if (id !== null && names.length) highlightsByRoom.set(id, names.slice(0, 8));
  }
  if (Array.isArray(catalog)) {
    for (const r of catalog as RawRoom[]) {
      const translations = r.translations as RawRoom | undefined;
      const occupancy = r.occupancy as RawRoom | undefined;
      const rawPhotos = Array.isArray(r.roomPhotos) ? (r.roomPhotos as RawRoom[]) : [];
      const photos = withPhotos
        ? rawPhotos
            .map((p) => str(p.photoUri))
            .filter((u): u is string => u !== null)
            .slice(0, MAX_PHOTOS_PER_ROOM)
            .map((u) => `https://cf.bstatic.com${u}`)
        : [];
      push(
        str(translations?.name),
        num(r.roomSizeM2),
        num(occupancy?.maxPersons),
        highlightsByRoom.get(num(r.id) ?? -1) ?? null,
        photos,
      );
    }
  }
  if (out.length) return out;

  // Fallback: the availability table (only rooms bookable for the stay dates;
  // sizes hide in facility strings like "258 feet²").
  const raw = (Array.isArray(item.rooms) ? item.rooms : []) as RawRoom[];
  for (const r of raw) {
    const name = str(r.name) ?? str(r.roomType) ?? str(r.title) ?? str(r.type);
    const sizeSqm =
      num(r.size) ?? num(r.roomSize) ?? num(r.sizeSqm) ?? num(r.area) ?? sizeFromStrings(r);
    const persons =
      num(r.persons) ?? num(r.maxPersons) ?? num(r.maxOccupancy) ?? num(r.guests);
    push(name, sizeSqm, persons);
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

/** Same loose similarity check the Places enrichment uses to flag mismatches.
 * Accent-folded ("Melia" must match "Meliá") — learned from the full run. */
function looksAlike(ours: string, theirs: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
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
  // sortOrder = smallest room first (admin request); unknown sizes go last.
  const bySize = [...extracted].sort((a, b) => (a.sizeSqm ?? Infinity) - (b.sizeSqm ?? Infinity));
  await db.insert(rooms).values(
    bySize.map((r, i) => {
      const { occ, icon } = occupancyOf(r.persons, r.name);
      return {
        hotelId: target.id,
        name: r.name.slice(0, 160),
        icon,
        sizeSqm: r.sizeSqm,
        occupancy: occ,
        facilities: r.facilities,
        photos: r.photos,
        photoUrl: r.photos?.[0] ?? null, // legacy cover column === photos[0]
        sortOrder: i,
      };
    }),
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

type Report = { dest: string; ours: string; matched: string; roomCount: number; flag: string };

async function main() {
  const targets = await collectTargets();
  // Two hotels sharing one resolved URL can't both be right: keep the one whose
  // name tokens actually appear in the slug, unresolve the rest (BUS pilot:
  // Ramada Plaza and Wyndham Batumi both landed on the Wyndham property).
  const bySlugGroup = new Map<string, Target[]>();
  for (const t of targets) {
    const s = slugOf(t.propertyUrl);
    if (!s) continue;
    bySlugGroup.set(s, [...(bySlugGroup.get(s) ?? []), t]);
  }
  for (const [slug, group] of bySlugGroup) {
    if (group.length < 2) continue;
    const slugText = slug.split("/").pop()!.replace(/-/g, " ");
    const scored = group
      .map((t) => ({ t, ok: looksAlike(t.name, slugText) }))
      .sort((a, b) => Number(b.ok) - Number(a.ok));
    for (const { t } of scored.slice(1)) t.propertyUrl = null; // keep best only
    console.log(`  shared URL ${slug}: kept "${scored[0].t.name}", unresolved ${group.length - 1} other(s)`);
  }
  const direct = targets.filter((t) => t.propertyUrl);
  const unresolved = targets.filter((t) => !t.propertyUrl);
  console.log(
    `Targets: ${targets.length} hotels — ${direct.length} with property URLs → 1 batch run` +
      `${unresolved.length ? `, ${unresolved.length} UNRESOLVED (need the Playwright resolver + --resolved)` : ""}. ` +
      (fromDataset
        ? `Reprocessing stored dataset ${fromDataset} — no charges.`
        : `Estimated cost ≈ $${(direct.length * COST_PER_HOTEL_USD).toFixed(2)}.`),
  );
  if (!targets.length) return;
  if (!confirmed && !fromDataset) {
    console.log("\nDry run (no charges made). Re-run with --yes to start the Apify runs.");
    return;
  }

  const report: Report[] = [];
  const stay = stayInput();

  // 1) One batched run for every hotel with a direct property URL — or, with
  //    --from-dataset, the already-scraped items of a previous run (free).
  if (direct.length) {
    let items: RawRoom[];
    if (fromDataset) {
      const res = await fetch(`${API}/datasets/${fromDataset}/items?token=${TOKEN}&clean=true`);
      if (!res.ok) throw new Error(`dataset ${fromDataset}: ${res.status}`);
      items = (await res.json()) as RawRoom[];
      console.log(`\nLoaded ${items.length} stored items from dataset ${fromDataset}`);
    } else {
      console.log(`\nStarting batch run for ${direct.length} property URLs…`);
      const runId = await startRun({
        startUrls: direct.map((t) => ({ url: t.propertyUrl })),
        maxItems: direct.length,
        ...stay,
      });
      console.log(`  run ${runId} — polling`);
      items = (await awaitRunItems(runId, 45)) as RawRoom[];
      console.log(`  run done: ${items.length} items`);
    }

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
      const matchedName = str(item.name) ?? "?";
      // Final guard over the resolver too: if the scraped property's name
      // doesn't look like ours, NOTHING is written — wrong rooms shown with
      // confidence are worse than an empty list (learned from the BUS pilot,
      // where city-token scoring mapped 9 hotels onto one property).
      if (!looksAlike(t.name, matchedName)) {
        if (clearUnmatched) await writeRooms(t, []);
        report.push({ dest: t.dest, ours: t.name, matched: matchedName, roomCount: 0, flag: "⚠ SKIPPED (mismatch)" });
        console.log(`  ⚠ ${t.name} ≠ ${matchedName}: skipped${clearUnmatched ? ", rows cleared" : ", nothing written"}`);
        continue;
      }
      const extracted = extractRooms(item, wantsPhotos(t));
      await writeRooms(t, extracted);
      report.push({
        dest: t.dest,
        ours: t.name,
        matched: matchedName,
        roomCount: extracted.length,
        flag: extracted.length ? "ok" : "⚠ 0 ROOMS",
      });
      console.log(`  ${extracted.length ? "✓" : "—"} ${t.name}: ${extracted.length} rooms`);
    }
  }

  // 2) Hotels the resolver couldn't map to a property URL are reported, never
  //    guessed — a wrong property would silently show another hotel's rooms.
  for (const t of unresolved) {
    if (clearUnmatched) await writeRooms(t, []);
    report.push({ dest: t.dest, ours: t.name, matched: "(unresolved URL)", roomCount: 0, flag: "⚠ UNRESOLVED" });
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
