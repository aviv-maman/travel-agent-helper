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

/** Room-size slider step (m²) and the generic fallback bounds used when a
 *  destination has no sized rooms to derive real ones from. At the ceiling the
 *  max is treated as "no upper limit" so a "≥ N m²" filter still includes the
 *  largest suites. */
export const ROOM_SIZE_STEP = 5;
export const ROOM_SIZE_FALLBACK_FLOOR = 10;
export const ROOM_SIZE_FALLBACK_CEIL = 100;

/**
 * Slider bounds (m²) for a destination, derived from its actual room sizes:
 * the ceiling is the largest room, the floor is 10 m² (or the smallest room
 * when it is smaller). Both are snapped to the step so the thumbs land on clean
 * values. `min`/`max` are the destination's smallest/largest sized room (null
 * when it has none) → a generic 10–100 range is used as a fallback.
 */
export function roomSizeBounds(
  min: number | null,
  max: number | null,
): { floor: number; ceil: number; step: number } {
  const step = ROOM_SIZE_STEP;
  if (min == null || max == null) {
    return { floor: ROOM_SIZE_FALLBACK_FLOOR, ceil: ROOM_SIZE_FALLBACK_CEIL, step };
  }
  const floor = Math.max(step, step * Math.floor(Math.min(ROOM_SIZE_FALLBACK_FLOOR, min) / step));
  const ceil = Math.max(floor + step, step * Math.ceil(max / step));
  return { floor, ceil, step };
}

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
