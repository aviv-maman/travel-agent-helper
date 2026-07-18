import type {
  HotelTagValue,
  HotelFeatureValue,
  BoardCode,
  DestinationInfo,
  Localized,
} from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { getIlsRates, toIls, type IlsRates } from "./money";
import { smartNormalize, smartScore } from "./search";

/**
 * Pick a translatable value for the active locale. No cross-language fallback:
 * if the locale has no translation yet, returns "" so the UI shows that locale
 * only (and callers can hide empty fields).
 */
export function localized(value: Localized | null | undefined, locale: string): string {
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
  /** Booking's compact per-room highlight chips (English), e.g. "Minibar". */
  facilities: string[];
  photoUrl: string | null;
};

export type UIHotel = {
  id: string;
  name: string;
  stars: number | null;
  tags: HotelTagValue[];
  boards: BoardCode[];
  bookingScore: number | null;
  googleMapsUrl: string | null;
  bookingUrl: string | null;
  /** Google Places enrichment (DB-managed; null in the no-DB seed fallback). */
  googlePlaceId: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  address: string | null;
  websiteUrl: string | null;
  photoUrl: string | null;
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
  "default" | "stars-desc" | "stars-asc" | "booking-desc" | "booking-asc" | `dist:${string}`;

const DEFAULT_PER_PAGE = 24;

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
  facilities: string[];
  photoUrl: string | null;
};
export type ViewHotel = {
  id: string;
  name: string;
  stars: number | null;
  tags: HotelTagValue[];
  boards: BoardCode[];
  bookingScore: number | null;
  googleMapsUrl: string | null;
  bookingUrl: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  address: string | null;
  websiteUrl: string | null;
  photoUrl: string | null;
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
  /** `price` converted to shekels for display, e.g. "~95–135 ₪". */
  priceIls?: string;
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

/** A single destination: filtered + sorted + paginated (server-computed). */
export type DestinationView = {
  iata: string;
  name: string;
  country: string;
  countryCode: string;
  info: ViewInfo | null;
  landmarks: ViewLandmark[];
  hotels: ViewHotel[];
  /** All hotel names in this destination (post filters, pre name-query) for autocomplete. */
  hotelNames: string[];
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
  rates: IlsRates,
): ViewInfo | null {
  if (!info) return null;
  const pick = (v: Localized | null | undefined) => localized(v, locale) || undefined;
  const transport = (info.transport ?? [])
    .map((r) => ({
      icon: r.icon,
      mode: localized(r.mode, locale),
      detail: localized(r.detail, locale),
      price: r.price,
      priceIls: r.price ? toIls(r.price, rates) : undefined,
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
    tags: h.tags,
    boards: h.boards,
    bookingScore: h.bookingScore,
    // A Places-enriched hotel links to its actual Google place card. The stored
    // URL (a name search, or raw geocoded coords on skill-built destinations)
    // only lands NEAR the hotel — it remains the un-enriched fallback.
    googleMapsUrl: h.googlePlaceId
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name)}&query_place_id=${h.googlePlaceId}`
      : h.googleMapsUrl,
    bookingUrl: h.bookingUrl,
    googleRating: h.googleRating,
    googleReviewCount: h.googleReviewCount,
    address: h.address,
    websiteUrl: h.websiteUrl,
    photoUrl: h.photoUrl,
    roomsNote: localized(h.roomsNote, locale) || null,
    features: h.features,
    distances: h.distances.map((d) => ({
      landmarkKey: d.landmarkKey,
      name: localized(d.name, locale),
      meters: d.meters,
      walkMinutes: d.walkMinutes,
      rideMinutes: d.rideMinutes,
    })),
    // Smallest room first, unknown sizes last (admin request 2026-07-18).
    rooms: [...h.rooms]
      .sort((a, b) => (a.sizeSqm ?? Infinity) - (b.sizeSqm ?? Infinity))
      .map((r) => ({
        name: r.name,
        icon: r.icon,
        sizeSqm: r.sizeSqm,
        occupancy: localized(r.occupancy, locale) || null,
        facilities: r.facilities,
        photoUrl: r.photoUrl,
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
          h.distances.find((d) => d.landmarkKey === key)?.meters ?? Number.POSITIVE_INFINITY;
        return list.sort((a, b) => m(a) - m(b));
      }
      // "default" → alphabetical (A→Z) by hotel name.
      return list.sort((a, b) => a.name.localeCompare(b.name));
  }
}

/** Destinations for the picker, resolved to `locale` (with a cross-locale search blob). */
export async function getDestinationsList(locale: string): Promise<DestinationSummary[]> {
  const all = await getHotelData();
  return all.map((d) => ({
    iata: d.iata,
    name: localized(d.name, locale),
    country: localized(d.country, locale),
    countryCode: d.countryCode,
    search: [...Object.values(d.name), ...Object.values(d.country), d.iata].join(" "),
  }));
}

/**
 * One destination, with its hotels filtered (AND over features), sorted, and
 * resolved to `locale`. All filtering + translation happens on the server —
 * the client only receives the matching subset in one language.
 */
export async function getDestinationView(
  iata: string,
  opts: {
    tags?: HotelTagValue[];
    boards?: BoardCode[];
    features?: HotelFeatureValue[];
    /** Free-text hotel-name query (smart, Hebrew-aware). */
    q?: string;
    sort?: SortMode;
    page?: number;
    perPage?: number;
    locale: string;
  },
): Promise<DestinationView | null> {
  const tags = opts.tags ?? [];
  const boards = opts.boards ?? [];
  const features = opts.features ?? [];
  const query = (opts.q ?? "").trim();
  const sort = opts.sort ?? "default";
  const perPage = opts.perPage && opts.perPage > 0 ? opts.perPage : DEFAULT_PER_PAGE;
  const locale = opts.locale;
  const all = await getHotelData();
  const d = all.find((x) => x.iata === iata);
  if (!d) return null;
  const rates = await getIlsRates();

  // amenities AND; tags / boards each OR within themselves.
  const baseFiltered = d.hotels.filter(
    (h) =>
      features.every((f) => h.features.includes(f)) &&
      (tags.length === 0 || tags.some((t) => h.tags.includes(t))) &&
      (boards.length === 0 || boards.some((b) => h.boards.includes(b))),
  );

  // Autocomplete suggestions reflect the current filter context (not the name
  // query itself), sorted A→Z and de-duplicated.
  const hotelNames = [...new Set(baseFiltered.map((h) => h.name))].sort((a, b) =>
    a.localeCompare(b),
  );

  // Narrow by the name query (smart fuzzy match), then apply the chosen sort.
  const nameMatched = query
    ? baseFiltered.filter((h) => smartScore(query, smartNormalize(h.name)) >= 0)
    : baseFiltered;
  const filtered = sortHotels(nameMatched, sort);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);
  const pageHotels = filtered.slice((page - 1) * perPage, page * perPage);

  return {
    iata: d.iata,
    name: localized(d.name, locale),
    country: localized(d.country, locale),
    countryCode: d.countryCode,
    info: resolveInfo(d.info, locale, rates),
    landmarks: d.landmarks.map((l) => ({
      key: l.key,
      name: localized(l.name, locale),
    })),
    hotels: pageHotels.map((h) => resolveHotel(h, locale)),
    hotelNames,
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
      tags: h.tags.map((t) => t.tag),
      boards: (h.boards ?? []) as BoardCode[],
      bookingScore: h.bookingScore,
      googleMapsUrl: h.googleMapsUrl,
      bookingUrl: h.bookingUrl,
      googlePlaceId: h.googlePlaceId,
      googleRating: h.googleRating,
      googleReviewCount: h.googleReviewCount,
      address: h.address,
      websiteUrl: h.websiteUrl,
      photoUrl: h.photoUrl,
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
        facilities: r.facilities ?? [],
        photoUrl: r.photoUrl,
      })),
    })),
  }));
}

async function loadFromSeed(): Promise<UIDestination[]> {
  const legacy = (await import("../data/seed.json")).default as SeedShape[];
  // Add-on destinations (built by the add-destination skill) share the shape.
  const { EXTRA_DESTINATIONS } = await import("../data/destinations");
  const seed = [...legacy, ...(EXTRA_DESTINATIONS as unknown as SeedShape[])];
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
        tags: (h.tags ?? []) as HotelTagValue[],
        boards: (h.boards ?? []) as BoardCode[],
        bookingScore: h.bookingScore,
        googleMapsUrl: h.googleMapsUrl,
        bookingUrl: h.bookingUrl,
        // Places enrichment is DB-managed — the seed fallback has none.
        googlePlaceId: null,
        googleRating: null,
        googleReviewCount: null,
        address: null,
        websiteUrl: null,
        photoUrl: null,
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
          facilities: r.facilities ?? [],
          photoUrl: r.photoUrl ?? null,
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
      facilities?: string[] | null;
      photoUrl?: string | null;
    }[];
  }[];
};
