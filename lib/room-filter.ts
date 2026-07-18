/**
 * Room-level filtering shared by the server (which hides hotels with no matching
 * room) and the client modal (which shows only the matching rooms). Pure — no db
 * / server-only imports — so both sides run the exact same logic.
 *
 * Facilities are Booking's English highlight strings; we match the three the
 * admin filters on by their canonical labels.
 */

export const ROOM_AMENITIES = ["balcony", "ac", "minibar"] as const;
export type RoomAmenity = (typeof ROOM_AMENITIES)[number];

/** The Booking facility label each amenity toggle matches. */
const FACILITY_LABEL: Record<RoomAmenity, string> = {
  balcony: "Balcony",
  ac: "Air conditioning",
  minibar: "Minibar",
};

/** Slider bounds for room size (m²). At the ceiling the max is treated as "no
 *  upper limit" so a "≥ N m²" filter still includes the rare large suites. */
export const ROOM_SIZE_MIN = 0;
export const ROOM_SIZE_MAX = 100;
export const ROOM_SIZE_STEP = 5;

export type RoomFilter = {
  /** m², null = no lower bound. */
  minSize: number | null;
  /** m², null = no upper bound. */
  maxSize: number | null;
  amenities: RoomAmenity[];
};

export function emptyRoomFilter(): RoomFilter {
  return { minSize: null, maxSize: null, amenities: [] };
}

export function isRoomFilterActive(f: RoomFilter): boolean {
  return f.minSize != null || f.maxSize != null || f.amenities.length > 0;
}

type RoomLike = { sizeSqm: number | null; facilities: string[] };

/** True when a single room satisfies every active criterion (AND). */
export function roomMatches(room: RoomLike, f: RoomFilter): boolean {
  if (f.minSize != null || f.maxSize != null) {
    // Unknown/zero size can't satisfy a size filter.
    if (room.sizeSqm == null || room.sizeSqm <= 0) return false;
    if (f.minSize != null && room.sizeSqm < f.minSize) return false;
    if (f.maxSize != null && room.sizeSqm > f.maxSize) return false;
  }
  for (const a of f.amenities) {
    if (!room.facilities.includes(FACILITY_LABEL[a])) return false;
  }
  return true;
}

/** A hotel passes when it has at least one room matching the filter. */
export function hotelHasMatchingRoom(rooms: RoomLike[], f: RoomFilter): boolean {
  if (!isRoomFilterActive(f)) return true;
  return rooms.some((r) => roomMatches(r, f));
}

/** Parse the comma list from the `ramen` URL param into valid amenity keys. */
export function parseRoomAmenities(raw: string | null | undefined): RoomAmenity[] {
  if (!raw) return [];
  const set = new Set(raw.split(",").map((s) => s.trim()));
  return ROOM_AMENITIES.filter((a) => set.has(a));
}

/** Clamp/parse a size param to a non-negative integer, or null. */
export function parseSize(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}
