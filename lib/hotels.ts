import type {
  HotelTier,
  HotelTagValue,
  HotelFeatureValue,
  BoardCode,
  DestinationInfo,
  Localized,
} from "@/db/schema";
import type { Locale } from "@/i18n/config";

/**
 * Pick a translatable value for the active locale. No cross-language fallback:
 * if the locale has no translation yet, returns "" so the UI shows that locale
 * only (and callers can hide empty fields).
 */
export function localized(
  value: Localized | null | undefined,
  locale: string,
): string {
  return value?.[locale as Locale] ?? "";
}

/** Convert an ISO 3166-1 alpha-2 country code to its flag emoji (e.g. "GE" → 🇬🇪). */
export function flagEmoji(countryCode: string): string {
  if (!/^[A-Za-z]{2}$/.test(countryCode)) return "";
  return countryCode
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/** UI-facing shapes assembled from either the DB or the seed JSON fallback. */
export type UIDistance = {
  landmarkKey: string;
  name: Localized;
  meters: number | null;
  walkMinutes: number | null;
  rideMinutes: number | null;
};

export type UIRoom = {
  name: string;
  icon: string | null;
  sizeSqm: number | null;
  occupancy: Localized | null;
};

export type UIHotel = {
  id: string;
  name: string;
  stars: number | null;
  tier: HotelTier;
  tags: HotelTagValue[];
  boards: BoardCode[];
  bookingScore: number | null;
  googleMapsUrl: string | null;
  bookingUrl: string | null;
  roomsNote: Localized | null;
  features: HotelFeatureValue[];
  distances: UIDistance[];
  rooms: UIRoom[];
};

export type UILandmark = { key: string; name: Localized };

export type UIDestination = {
  iata: string;
  name: Localized;
  country: Localized;
  countryCode: string;
  info: DestinationInfo | null;
  landmarks: UILandmark[];
  hotels: UIHotel[];
};

export type SortMode =
  | "default"
  | "stars-desc"
  | "stars-asc"
  | "booking-desc"
  | "booking-asc"
  | `dist:${string}`;

/** How the result list is grouped into sections. */
export type GroupBy = "quality" | "stars" | "booking";

export const TIER_ORDER: Record<HotelTier, number> = { premium: 0, good: 1 };

const DEFAULT_PER_PAGE = 24;

/** Booking-score bucket id for the "Booking Rating" grouping. */
function bookingBucket(score: number | null): string {
  if (score == null) return "none";
  if (score >= 9) return "9";
  if (score >= 8) return "8";
  if (score >= 7) return "7";
  return "lt7";
}

/** A hotel's group key + sort order for the chosen grouping. */
function groupOf(h: UIHotel, groupBy: GroupBy): { key: string; order: number } {
  switch (groupBy) {
    case "stars": {
      const s = h.stars ?? 0;
      return { key: h.stars == null ? "none" : String(h.stars), order: -s };
    }
    case "booking": {
      const key = bookingBucket(h.bookingScore);
      const order = { "9": 0, "8": 1, "7": 2, lt7: 3, none: 4 }[key] ?? 99;
      return { key, order };
    }
    default:
      return { key: h.tier, order: TIER_ORDER[h.tier] };
  }
}

/*
 * Locale-resolved view types. The server resolves every Localized value to the
 * active locale's plain string before returning, so the client only receives
 * the language it will display (no other-language data crosses the wire).
 */
export type ViewDistance = {
  landmarkKey: string;
  name: string;
  meters: number | null;
  walkMinutes: number | null;
  rideMinutes: number | null;
};
export type ViewRoom = {
  name: string;
  icon: string | null;
  sizeSqm: number | null;
  occupancy: string | null;
};
export type ViewHotel = {
  id: string;
  name: string;
  stars: number | null;
  tier: HotelTier;
  tags: HotelTagValue[];
  boards: BoardCode[];
  bookingScore: number | null;
  googleMapsUrl: string | null;
  bookingUrl: string | null;
  roomsNote: string | null;
  features: HotelFeatureValue[];
  distances: ViewDistance[];
  rooms: ViewRoom[];
};
export type ViewLandmark = { key: string; name: string };
export type ViewTransport = {
  icon?: string;
  mode?: string;
  detail?: string;
  price?: string;
};
export type ViewInfo = {
  warnings: string[];
  about?: string;
  attractions?: string;
  currencyNote?: string;
  airport?: { title?: string; note?: string };
  transport?: ViewTransport[];
  landmarks?: string;
};

/** A section of hotels. `key` is interpreted per the active groupBy (the client
 * maps it to a label): tier value, star count, or booking bucket id. */
export type HotelGroup = { key: string; hotels: ViewHotel[] };

/** A single destination: filtered + sorted + paginated + grouped (server-computed). */
export type DestinationView = {
  iata: string;
  name: string;
  country: string;
  countryCode: string;
  info: ViewInfo | null;
  landmarks: ViewLandmark[];
  groupBy: GroupBy;
  groups: HotelGroup[];
  /** Pagination over the flat filtered list (before grouping). */
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

/** Lightweight destination list for the combobox. `search` matches any locale. */
export type DestinationSummary = {
  iata: string;
  name: string;
  country: string;
  countryCode: string;
  search: string;
};

function resolveInfo(
  info: DestinationInfo | null,
  locale: string,
): ViewInfo | null {
  if (!info) return null;
  const pick = (v: Localized | null | undefined) => localized(v, locale) || undefined;
  const transport = (info.transport ?? [])
    .map((r) => ({
      icon: r.icon,
      mode: localized(r.mode, locale),
      detail: localized(r.detail, locale),
      price: r.price,
    }))
    .filter((r) => r.mode || r.detail);
  return {
    warnings: (info.warnings ?? []).map((w) => localized(w, locale)).filter(Boolean),
    about: pick(info.about),
    attractions: pick(info.attractions),
    currencyNote: pick(info.currencyNote),
    airport: info.airport
      ? { title: pick(info.airport.title), note: pick(info.airport.note) }
      : undefined,
    transport: transport.length ? transport : undefined,
    landmarks: pick(info.landmarks),
  };
}

function resolveHotel(h: UIHotel, locale: string): ViewHotel {
  return {
    id: h.id,
    name: h.name,
    stars: h.stars,
    tier: h.tier,
    tags: h.tags,
    boards: h.boards,
    bookingScore: h.bookingScore,
    googleMapsUrl: h.googleMapsUrl,
    bookingUrl: h.bookingUrl,
    roomsNote: localized(h.roomsNote, locale) || null,
    features: h.features,
    distances: h.distances.map((d) => ({
      landmarkKey: d.landmarkKey,
      name: localized(d.name, locale),
      meters: d.meters,
      walkMinutes: d.walkMinutes,
      rideMinutes: d.rideMinutes,
    })),
    rooms: h.rooms.map((r) => ({
      name: r.name,
      icon: r.icon,
      sizeSqm: r.sizeSqm,
      occupancy: localized(r.occupancy, locale) || null,
    })),
  };
}

function sortHotels(hotels: UIHotel[], mode: SortMode): UIHotel[] {
  const list = [...hotels];
  switch (mode) {
    case "stars-desc":
      return list.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    case "stars-asc":
      return list.sort((a, b) => (a.stars ?? 0) - (b.stars ?? 0));
    case "booking-desc":
      return list.sort((a, b) => (b.bookingScore ?? 0) - (a.bookingScore ?? 0));
    case "booking-asc":
      return list.sort((a, b) => (a.bookingScore ?? 0) - (b.bookingScore ?? 0));
    default:
      if (mode.startsWith("dist:")) {
        const key = mode.slice(5);
        const m = (h: UIHotel) =>
          h.distances.find((d) => d.landmarkKey === key)?.meters ??
          Number.POSITIVE_INFINITY;
        return list.sort((a, b) => m(a) - m(b));
      }
      return list; // "default" → original sortOrder
  }
}

/** Destinations for the picker, resolved to `locale` (with a cross-locale search blob). */
export async function getDestinationsList(
  locale: string,
): Promise<DestinationSummary[]> {
  const all = await getHotelData();
  return all.map((d) => ({
    iata: d.iata,
    name: localized(d.name, locale),
    country: localized(d.country, locale),
    countryCode: d.countryCode,
    search: [...Object.values(d.name), ...Object.values(d.country), d.iata].join(
      " ",
    ),
  }));
}

/**
 * One destination, with its hotels filtered (AND over features) and sorted,
 * grouped by tier, and resolved to `locale`. All filtering + translation happens
 * on the server — the client only receives the matching subset in one language.
 */
export async function getDestinationView(
  iata: string,
  opts: {
    quality?: HotelTier[];
    tags?: HotelTagValue[];
    boards?: BoardCode[];
    features?: HotelFeatureValue[];
    minBooking?: number;
    sort?: SortMode;
    groupBy?: GroupBy;
    page?: number;
    perPage?: number;
    locale: string;
  },
): Promise<DestinationView | null> {
  const quality = opts.quality ?? [];
  const tags = opts.tags ?? [];
  const boards = opts.boards ?? [];
  const features = opts.features ?? [];
  const minBooking = opts.minBooking ?? null;
  const sort = opts.sort ?? "default";
  const groupBy = opts.groupBy ?? "quality";
  const perPage = opts.perPage && opts.perPage > 0 ? opts.perPage : DEFAULT_PER_PAGE;
  const locale = opts.locale;
  const all = await getHotelData();
  const d = all.find((x) => x.iata === iata);
  if (!d) return null;

  // amenities AND; quality / tags / boards each OR within themselves; min booking.
  const filtered = sortHotels(
    d.hotels.filter(
      (h) =>
        features.every((f) => h.features.includes(f)) &&
        (quality.length === 0 || quality.includes(h.tier)) &&
        (tags.length === 0 || tags.some((t) => h.tags.includes(t))) &&
        (boards.length === 0 || boards.some((b) => h.boards.includes(b))) &&
        (minBooking == null || (h.bookingScore ?? -1) >= minBooking),
    ),
    sort,
  );

  // Paginate the flat list, then group the current page per `groupBy`.
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);
  const pageHotels = filtered.slice((page - 1) * perPage, page * perPage);

  const buckets = new Map<string, { order: number; hotels: ViewHotel[] }>();
  for (const h of pageHotels) {
    const { key, order } = groupOf(h, groupBy);
    const b = buckets.get(key) ?? { order, hotels: [] };
    b.hotels.push(resolveHotel(h, locale));
    buckets.set(key, b);
  }
  const groups: HotelGroup[] = [...buckets.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, b]) => ({ key, hotels: b.hotels }));

  return {
    iata: d.iata,
    name: localized(d.name, locale),
    country: localized(d.country, locale),
    countryCode: d.countryCode,
    info: resolveInfo(d.info, locale),
    landmarks: d.landmarks.map((l) => ({
      key: l.key,
      name: localized(l.name, locale),
    })),
    groupBy,
    groups,
    total,
    page,
    perPage,
    totalPages,
  };
}

export function usingDatabase(): boolean {
  const url = process.env.DATABASE_URL;
  return Boolean(url && !url.includes("placeholder"));
}

/** Loads hotel data — from Neon when configured, otherwise the seed JSON. */
export async function getHotelData(): Promise<UIDestination[]> {
  if (usingDatabase()) {
    return loadFromDb();
  }
  return loadFromSeed();
}

async function loadFromDb(): Promise<UIDestination[]> {
  const { db } = await import("@/db");
  const rows = await db.query.destinations.findMany({
    orderBy: (d, { asc }) => [asc(d.sortOrder)],
    with: {
      landmarks: true,
      hotels: {
        orderBy: (h, { asc }) => [asc(h.sortOrder)],
        with: {
          features: true,
          tags: true,
          distances: { with: { landmark: true } },
          rooms: { orderBy: (r, { asc }) => [asc(r.sortOrder)] },
        },
      },
    },
  });

  return rows.map((d) => ({
    iata: d.iata,
    name: d.name,
    country: d.country,
    countryCode: d.countryCode,
    info: d.info ?? null,
    landmarks: d.landmarks.map((l) => ({ key: l.key, name: l.name })),
    hotels: d.hotels.map((h) => ({
      id: String(h.id),
      name: h.name,
      stars: h.stars,
      tier: h.tier,
      tags: h.tags.map((t) => t.tag),
      boards: (h.boards ?? []) as BoardCode[],
      bookingScore: h.bookingScore,
      googleMapsUrl: h.googleMapsUrl,
      bookingUrl: h.bookingUrl,
      roomsNote: h.roomsNote,
      features: h.features.map((f) => f.feature),
      distances: h.distances.map((dist) => ({
        landmarkKey: dist.landmark.key,
        name: dist.landmark.name,
        meters: dist.meters,
        walkMinutes: dist.walkMinutes,
        rideMinutes: dist.rideMinutes,
      })),
      rooms: h.rooms.map((r) => ({
        name: r.name,
        icon: r.icon,
        sizeSqm: r.sizeSqm,
        occupancy: r.occupancy,
      })),
    })),
  }));
}

async function loadFromSeed(): Promise<UIDestination[]> {
  const seed = (await import("../data/seed.json")).default as SeedShape[];
  return seed.map((d) => {
    const lmName = new Map(d.landmarks.map((l) => [l.key, l.name]));
    return {
      iata: d.iata,
      name: d.name,
      country: d.country,
      countryCode: d.countryCode,
      info: (d.info ?? null) as DestinationInfo | null,
      landmarks: d.landmarks,
      hotels: d.hotels.map((h, i) => ({
        id: `${d.code}-${i}`,
        name: h.name,
        stars: h.stars,
        tier: h.tier as HotelTier,
        tags: (h.tags ?? []) as HotelTagValue[],
        boards: (h.boards ?? []) as BoardCode[],
        bookingScore: h.bookingScore,
        googleMapsUrl: h.googleMapsUrl,
        bookingUrl: h.bookingUrl,
        roomsNote: h.roomsNote ?? null,
        features: h.features as HotelFeatureValue[],
        distances: h.distances.map((dist) => ({
          landmarkKey: dist.landmarkKey,
          name: lmName.get(dist.landmarkKey) ?? {
            en: dist.landmarkKey,
            he: dist.landmarkKey,
          },
          meters: dist.meters,
          walkMinutes: dist.walkMinutes,
          rideMinutes: dist.rideMinutes,
        })),
        rooms: (h.rooms ?? []).map((r) => ({
          name: r.name,
          icon: r.icon,
          sizeSqm: r.sizeSqm,
          occupancy: r.occupancy,
        })),
      })),
    };
  });
}

// Minimal shape of data/seed.json for the fallback path.
type SeedShape = {
  code: string;
  iata: string;
  name: Localized;
  country: Localized;
  countryCode: string;
  info: DestinationInfo | null;
  landmarks: UILandmark[];
  hotels: {
    name: string;
    stars: number | null;
    tier: string;
    tags: string[];
    boards: string[];
    bookingScore: number | null;
    googleMapsUrl: string | null;
    bookingUrl: string | null;
    roomsNote: Localized | null;
    features: string[];
    distances: {
      landmarkKey: string;
      meters: number | null;
      walkMinutes: number | null;
      rideMinutes: number | null;
    }[];
    rooms: {
      name: string;
      icon: string | null;
      sizeSqm: number | null;
      occupancy: Localized | null;
    }[];
  }[];
};
