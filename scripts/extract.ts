/**
 * Parses the legacy `source/commissions-new.html` into structured seed data.
 * The HTML is the richest source (stars, board, features, booking score,
 * links, per-landmark distances as `data-<key>` attributes, the `ROOMS` JS
 * object, and the per-destination "about the city" info box).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import HE_TO_EN from "../data/translations.json";
import type {
  HotelTagValue,
  HotelFeatureValue,
  BoardCode,
  DestinationInfo,
  TransportOption,
  Localized,
} from "../db/schema";

export type SeedDistance = {
  landmarkKey: string;
  meters: number | null;
  walkMinutes: number | null;
  rideMinutes: number | null;
};

export type SeedRoom = {
  name: string;
  icon: string | null;
  sizeSqm: number | null;
  occupancy: Localized | null;
  sortOrder: number;
};

export type SeedHotel = {
  name: string;
  stars: number | null;
  tags: HotelTagValue[];
  boards: BoardCode[];
  bookingScore: number | null;
  googleMapsUrl: string | null;
  bookingUrl: string | null;
  roomsNote: Localized | null;
  sortOrder: number;
  features: HotelFeatureValue[];
  distances: SeedDistance[];
  rooms: SeedRoom[];
};

export type SeedLandmark = { key: string; name: Localized };

export type SeedDestination = {
  code: string;
  iata: string;
  name: Localized;
  country: Localized;
  countryCode: string;
  info: DestinationInfo;
  sortOrder: number;
  landmarks: SeedLandmark[];
  hotels: SeedHotel[];
};

// English names + ordering for the 7 destination section codes.
const DEST_META: Record<
  string,
  { nameEn: string; countryEn: string; countryCode: string; order: number }
> = {
  bus: { nameEn: "Batumi", countryEn: "Georgia", countryCode: "GE", order: 1 },
  bud: { nameEn: "Budapest", countryEn: "Hungary", countryCode: "HU", order: 2 },
  ath: { nameEn: "Athens", countryEn: "Greece", countryCode: "GR", order: 3 },
  the: { nameEn: "Thessaloniki", countryEn: "Greece", countryCode: "GR", order: 4 },
  tbi: { nameEn: "Tbilisi", countryEn: "Georgia", countryCode: "GE", order: 5 },
  sof: { nameEn: "Sofia", countryEn: "Bulgaria", countryCode: "BG", order: 6 },
  buc: { nameEn: "Bucharest", countryEn: "Romania", countryCode: "RO", order: 7 },
};

// Landmark metadata keyed by the `data-<key>` attribute used on hotel cards.
const LANDMARK_META: Record<string, { he: string; en: string }> = {
  europe: { he: "כיכר אירופה", en: "Europe Square" },
  chabad: { he: 'בית חב"ד', en: "Chabad House" },
  syntagma: { he: "כיכר סינטגמה", en: "Syntagma Square" },
  ermou: { he: "רחוב ארמו", en: "Ermou Street" },
  plaka: { he: "פלאקה", en: "Plaka" },
  omonia: { he: "כיכר אומוניה", en: "Omonia Square" },
  aristotelous: { he: "כיכר אריסטוטולוס", en: "Aristotelous Square" },
  ladadika: { he: "רובע לאדאדיקה", en: "Ladadika District" },
  freedom: { he: "כיכר החירות", en: "Freedom Square" },
  meidan: { he: "כיכר מיידן", en: "Meidan Square" },
  rustaveli: { he: "שדרות רוסטוולי", en: "Rustaveli Avenue" },
  vitosha: { he: "שדרות ויטושה", en: "Vitosha Boulevard" },
  synagogue: { he: "בית הכנסת / השוק", en: "Synagogue / Market" },
  cathedral: { he: "קתדרלת אלכסנדר נבסקי", en: "Alexander Nevsky Cathedral" },
  victoriei: { he: "שדרות הניצחון", en: "Victoriei Avenue" },
  oldtown: { he: "העיר העתיקה", en: "Old Town" },
  vaci: { he: "רחוב ואצי (Váci utca)", en: "Váci utca" },
  kiraly: { he: "הרובע היהודי (Király)", en: "Király (Jewish Quarter)" },
};

const NON_LANDMARK_KEYS = new Set(["booking", "idx", "stars", "tier"]);

// badge-<suffix> class → feature enum value(s). Kosher is now a tag, not a feature.
const FEATURE_MAP: Record<string, HotelFeatureValue[]> = {
  "pool-in": ["pool-in"],
  "pool-out": ["pool-out"],
  "pool-both": ["pool-in", "pool-out"],
  casino: ["casino"],
  "casino-near": ["casino-near"],
  waterpark: ["waterpark"],
  slides: ["waterpark"],
  outside: ["outside-center"],
};

// Hebrew board text → board code.
const BOARD_MAP: { match: string; code: BoardCode }[] = [
  { match: "בוקר", code: "bb" },
  { match: "חצי פנסיון", code: "hb" },
  { match: "פנסיון מלא", code: "fb" },
];

// The source HTML groups hotels into 4 sections; tiers are gone — the section
// only contributes tags now (resort → resort, kosher → kosher).
type SourceTier = "premium" | "good" | "resort" | "kosher";
const SOURCE_TIERS: SourceTier[] = ["premium", "good", "resort", "kosher"];
const TAG_FROM_SOURCE: Partial<Record<SourceTier, HotelTagValue>> = {
  resort: "resort",
  kosher: "kosher",
};

/** A cheerio selection (the element type cheerio.load produces by default). */
type Sel = ReturnType<cheerio.CheerioAPI>;

/** Wrap source text (Hebrew) as a Localized value, attaching English if known. */
const he = (s: string): Localized => {
  const en = (HE_TO_EN as Record<string, string>)[s];
  return en ? { he: s, en } : { he: s };
};

/** Strip everything but Hebrew/Latin letters for fuzzy landmark matching. */
function normalize(s: string): string {
  return s.replace(/[^א-תa-zA-Z]/g, "").toLowerCase();
}

function parseFirstInt(s: string): number | null {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function parseBoard(text: string | null): BoardCode | null {
  if (!text) return null;
  return BOARD_MAP.find((b) => text.includes(b.match))?.code ?? null;
}

/**
 * Parses a distance row's time text into walk/ride minutes.
 *   "5 דק' הליכה"            → walk 5
 *   "6 דק' נסיעה"            → ride 6
 *   "34 דק' / 6 דק' נסיעה"   → walk 34, ride 6
 */
function parseTimes(text: string | null): {
  walk: number | null;
  ride: number | null;
} {
  if (!text) return { walk: null, ride: null };
  const nums = (text.match(/\d+/g) ?? []).map(Number);
  if (text.includes("/") && text.includes("נסיעה")) {
    return { walk: nums[0] ?? null, ride: nums[1] ?? null };
  }
  if (text.includes("נסיעה")) return { walk: null, ride: nums[0] ?? null };
  if (text.includes("הליכה")) return { walk: nums[0] ?? null, ride: null };
  return { walk: null, ride: null };
}

type RawRoom = { icon?: string; name: string; size?: string; occ?: string };
type RawRoomData = { note?: string; rooms: RawRoom[] };

/** Extracts the `const ROOMS = {…}` object literal from the HTML source. */
function extractRoomsObject(html: string): Record<string, RawRoomData> {
  const m = html.match(/const ROOMS = (\{[\s\S]*?\n\};)/);
  if (!m) return {};
  const objText = m[1].replace(/;\s*$/, "");
  try {
    return new Function(`return (${objText})`)() as Record<string, RawRoomData>;
  } catch {
    return {};
  }
}

/** Smallest element text within `$scope` that contains `marker` (≈ the leaf). */
function pickLeaf($: cheerio.CheerioAPI, $scope: Sel, marker: string): string | null {
  let best: string | null = null;
  $scope.find("div,p").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.includes(marker) && (best === null || t.length < best.length)) {
      best = t;
    }
  });
  return best;
}

function parseInfo($: cheerio.CheerioAPI, $section: Sel, code: string): DestinationInfo {
  const info: DestinationInfo = {};

  // Gold warning banners (a destination may have several). Pick the innermost
  // element starting with ⚠️ so we don't capture wrapping containers.
  const warnings: string[] = [];
  $section.find("div").each((_, el) => {
    const $el = $(el);
    const txt = $el.text().replace(/\s+/g, " ").trim();
    if (!txt.startsWith("⚠️")) return;
    const hasInnerWarning = $el
      .find("div")
      .toArray()
      .some((d) => $(d).text().replace(/\s+/g, " ").trim().startsWith("⚠️"));
    if (!hasInnerWarning && !warnings.includes(txt)) warnings.push(txt);
  });
  // Source is Hebrew-only; wrap each value so English can be filled in later.
  if (warnings.length) info.warnings = warnings.map((w) => he(w));

  const $info = $section.find(`#info-${code}`);
  if (!$info.length) return info;

  const about = $info.find("p").first().text().replace(/\s+/g, " ").trim();
  if (about) info.about = he(about);

  $info.find("p").each((_, p) => {
    const t = $(p).text().replace(/\s+/g, " ").trim();
    if (t.includes("אתרים מרכזיים")) info.attractions = he(t);
  });

  const currency = pickLeaf($, $info, "המטבע המקומי");
  if (currency) info.currencyNote = he(currency);

  const airportTitle = pickLeaf($, $info, "שדה התעופה");
  const airportNote = pickLeaf($, $info, "מרחק:");
  if (airportTitle || airportNote) {
    info.airport = {
      title: airportTitle ? he(airportTitle) : undefined,
      note: airportNote ? he(airportNote) : undefined,
    };
  }

  const transport: TransportOption[] = [];
  $info.find("table tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 4) {
      const mode = $(tds[1]).text().replace(/\s+/g, " ").trim();
      const detail = $(tds[2]).text().replace(/\s+/g, " ").trim();
      transport.push({
        icon: $(tds[0]).text().trim() || undefined,
        mode: mode ? he(mode) : undefined,
        detail: detail ? he(detail) : undefined,
        price: $(tds[3]).text().replace(/\s+/g, " ").trim() || undefined,
      });
    }
  });
  if (transport.length) info.transport = transport;

  const landmarks = pickLeaf($, $info, "נקודות ציון");
  if (landmarks) info.landmarks = he(landmarks);

  return info;
}

export function extractSeed(htmlPath?: string): SeedDestination[] {
  const file = htmlPath ?? join(process.cwd(), "source", "commissions-new.html");
  const html = readFileSync(file, "utf8");
  const $ = cheerio.load(html);
  const ROOMS = extractRoomsObject(html);
  const destinations: SeedDestination[] = [];

  $(".dest-section").each((_, sectionEl) => {
    const $section = $(sectionEl);
    const id = $section.attr("id") ?? "";
    const code = id.replace(/^dest-/, "");
    const meta = DEST_META[code];
    if (!meta) return; // skip anything unexpected

    const iata = $section.find(".dest-flag").first().text().trim();
    const nameHe = $section.find(".dest-name").first().text().trim();
    const countryHe = $section.find(".dest-country").first().text().trim();

    const landmarksUsed = new Map<string, SeedLandmark>();
    const hotels: SeedHotel[] = [];
    let hotelOrder = 0;

    $section.find(".hotel-card").each((_, cardEl) => {
      const $card = $(cardEl);

      // Source section (4-way) → tags only (tiers were removed).
      const tierClass = $card.closest(".hotel-tier").find(".tier-icon").first().attr("class");
      const sourceTier = SOURCE_TIERS.find((k) => tierClass?.includes(`tier-icon-${k}`)) ?? "good";
      const tags = new Set<HotelTagValue>();
      const sourceTag = TAG_FROM_SOURCE[sourceTier];
      if (sourceTag) tags.add(sourceTag);

      const name = $card.find(".hotel-name").first().text().trim();
      if (!name) return;

      const stars = parseFirstInt($card.attr("data-stars") ?? "");
      const bookingRaw = $card.attr("data-booking");
      const bookingScore = bookingRaw ? parseFloat(bookingRaw) : null;
      // A hotel may list several board options (breakfast / half / full).
      const boards: BoardCode[] = [];
      $card.find(".board-tag").each((_, el) => {
        const code = parseBoard($(el).text().trim());
        if (code && !boards.includes(code)) boards.push(code);
      });

      // Features from badge classes. A kosher badge also adds the kosher tag.
      const features = new Set<HotelFeatureValue>();
      $card.find(".badge").each((_, b) => {
        const cls = $(b).attr("class") ?? "";
        const m = cls.match(/badge-([a-z-]+)/);
        if (!m) return;
        if (m[1] === "kosher") tags.add("kosher");
        else if (FEATURE_MAP[m[1]]) FEATURE_MAP[m[1]].forEach((f) => features.add(f));
      });

      // Links.
      let googleMapsUrl: string | null = null;
      let bookingUrl: string | null = null;
      $card.find("a[href]").each((_, a) => {
        const href = $(a).attr("href") ?? "";
        if (href.includes("google.") && href.includes("maps")) googleMapsUrl = href;
        else if (href.includes("booking.com")) bookingUrl = href;
      });

      // Distance table rows → normalized label → time text.
      const rowByLabel: { labelNorm: string; time: string }[] = [];
      $card.find("table tr").each((_, tr) => {
        const cells = $(tr).find("td");
        if (cells.length >= 2) {
          rowByLabel.push({
            labelNorm: normalize($(cells[0]).text()),
            time: $(cells[1]).text().trim(),
          });
        }
      });

      // Distances from data-<landmark> attributes.
      const distances: SeedDistance[] = [];
      const attribs = (cardEl as { attribs?: Record<string, string> }).attribs ?? {};
      for (const [attr, value] of Object.entries(attribs)) {
        if (!attr.startsWith("data-")) continue;
        const key = attr.slice(5);
        if (NON_LANDMARK_KEYS.has(key) || !LANDMARK_META[key]) continue;

        if (!landmarksUsed.has(key)) {
          landmarksUsed.set(key, {
            key,
            name: { en: LANDMARK_META[key].en, he: LANDMARK_META[key].he },
          });
        }

        const meters = parseFirstInt(value);
        const lmNorm = normalize(LANDMARK_META[key].he);
        const row = rowByLabel.find(
          (r) => r.labelNorm.includes(lmNorm) || lmNorm.includes(r.labelNorm),
        );
        const { walk, ride } = parseTimes(row?.time ?? null);
        distances.push({
          landmarkKey: key,
          meters,
          walkMinutes: walk,
          rideMinutes: ride,
        });
      }

      // Rooms from the ROOMS object (matched by hotel name).
      const raw = ROOMS[name];
      const rooms: SeedRoom[] = (raw?.rooms ?? []).map((r, i) => ({
        name: r.name,
        icon: r.icon ?? null,
        sizeSqm: r.size ? parseFirstInt(r.size) : null,
        occupancy: r.occ?.trim() ? he(r.occ.trim()) : null,
        sortOrder: i,
      }));

      hotels.push({
        name,
        stars,
        tags: [...tags],
        boards,
        bookingScore,
        googleMapsUrl,
        bookingUrl,
        roomsNote: raw?.note?.trim() ? he(raw.note.trim()) : null,
        sortOrder: hotelOrder++,
        features: [...features],
        distances,
        rooms,
      });
    });

    const info = parseInfo($, $section, code);

    destinations.push({
      code,
      iata,
      name: { en: meta.nameEn, he: nameHe },
      country: { en: meta.countryEn, he: countryHe },
      countryCode: meta.countryCode,
      info,
      sortOrder: meta.order,
      landmarks: [...landmarksUsed.values()],
      hotels,
    });
  });

  destinations.sort((a, b) => a.sortOrder - b.sortOrder);
  return destinations;
}
