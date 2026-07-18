/**
 * Consumer Protection Law cancellation deadline (Israeli tourism services).
 *
 * A customer may cancel a booking under the law only while BOTH hold:
 *   1. It is within 14 calendar days of the booking date (the 14th day counts).
 *   2. More than 7 business days still remain before departure.
 * The deadline is therefore the EARLIER of the two limits.
 *
 * Dates are plain "yyyy-mm-dd" strings and every Date built here is anchored to
 * 12:00 UTC, so no timezone can shift a day across a boundary — matching the
 * ISO-string convention in lib/dashboard/dates.ts. Pure (no deps, no I/O), so
 * it runs identically on the server and in the browser, and leap years fall out
 * of native Date arithmetic for free.
 */

import { todayInJerusalem } from "@/lib/dashboard/dates";

/** Noon-UTC Date for a "yyyy-mm-dd" string. Noon keeps any TZ on the same day. */
function toDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

/** "yyyy-mm-dd" for a Date built by `toDate` (always read back in UTC). */
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/**
 * The Hebrew date of a Gregorian day, via ICU — so the holiday calendar below
 * is derived, never a hand-maintained table that silently expires. Month names
 * ("Tishri", "Nisan", "Iyar", "Sivan") are used rather than indices because a
 * Hebrew leap year inserts Adar I/II and shifts every index after it.
 */
const HEBREW = new Intl.DateTimeFormat("en-u-ca-hebrew", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function hebrewParts(d: Date): { month: string; day: number } {
  const parts = HEBREW.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { month: get("month"), day: Number(get("day")) };
}

/**
 * The nine official rest days (Law and Administration Ordinance), by Hebrew
 * date. Intermediate festival days (Chol HaMoed) and fast days such as Tisha
 * B'Av are NOT rest days, and holiday EVES are ordinary business days — so
 * neither appears here, which is exactly what the spec asks for.
 */
const REST_DAYS: Record<string, number[]> = {
  Tishri: [1, 2, 10, 15, 22], // Rosh Hashanah ×2, Yom Kippur, Sukkot, Shmini Atzeret
  Nisan: [15, 21], // Pesach day 1, Pesach day 7
  Sivan: [6], // Shavuot
};

/**
 * Independence Day moves to keep Yom HaZikaron off Shabbat: 5 Iyar on a
 * Friday/Saturday is observed the preceding Thursday, and on a Monday it moves
 * forward to Tuesday. Any other weekday is observed on 5 Iyar itself.
 */
function isIndependenceDay(d: Date, heb: { month: string; day: number }): boolean {
  if (heb.month !== "Iyar" || heb.day < 3 || heb.day > 6) return false;
  const fifth = addDays(d, 5 - heb.day); // Hebrew and Gregorian days advance 1:1
  const shift = { 5: -1, 6: -2, 1: 1 }[fifth.getUTCDay()] ?? 0;
  return toIso(addDays(fifth, shift)) === toIso(d);
}

/** Whether a "yyyy-mm-dd" day is an official Israeli public holiday. */
export function isIsraeliHoliday(iso: string): boolean {
  const d = toDate(iso);
  const heb = hebrewParts(d);
  return REST_DAYS[heb.month]?.includes(heb.day) === true || isIndependenceDay(d, heb);
}

/** A business day is any day that is neither Saturday nor an official holiday. */
export function isBusinessDay(iso: string): boolean {
  return toDate(iso).getUTCDay() !== 6 && !isIsraeliHoliday(iso);
}

/**
 * Business days remaining before departure as of `iso`, counting `iso` itself
 * and excluding the departure day — the reading the spec's own example relies
 * on (booking 17/07 → departure 27/07 leaves 8, so the booking day qualifies,
 * and "after the booking date there are no longer more than 7").
 */
export function businessDaysUntil(iso: string, departure: string): number {
  let count = 0;
  for (let d = toDate(iso); toIso(d) < departure; d = addDays(d, 1)) {
    if (isBusinessDay(toIso(d))) count++;
  }
  return count;
}

/** The `n`th business day strictly before `departure`, walking backwards. */
function nthBusinessDayBefore(departure: string, n: number): string {
  let d = toDate(departure);
  for (let found = 0; found < n; ) {
    d = addDays(d, -1);
    if (isBusinessDay(toIso(d))) found++;
  }
  return toIso(d);
}

/** Which limit fixed the deadline. "none" = not cancelable under the law at
 * all (even the booking day already leaves ≤7 business days before departure). */
export type DeadlineLimit = "fourteenDays" | "businessDays" | "none";

export type DeadlineResult = {
  /** Last day the customer may cancel under the law, "yyyy-mm-dd" — null when
   * `limitedBy === "none"` (there is no eligible day). */
  deadline: string | null;
  /** The 14-calendar-day limit (booking + 14). */
  fourteenDayLimit: string;
  /** The last day still leaving more than 7 business days before departure. */
  businessDayLimit: string;
  limitedBy: DeadlineLimit;
};

/**
 * The cancellation deadline for a booking. `bookingDate` defaults to today in
 * Jerusalem (the agent's local day). Returns null if departure is not after
 * booking — there is no window to compute.
 */
export function cancellationDeadline(departure: string, bookingDate?: string): DeadlineResult | null {
  const booking = bookingDate || todayInJerusalem();
  if (!departure || departure <= booking) return null;

  const fourteenDayLimit = toIso(addDays(toDate(booking), 14));
  // Cancelling on the 8th business day back still leaves 8 (> 7); one day later
  // leaves exactly 7, which the law no longer protects.
  const businessDayLimit = nthBusinessDayBefore(departure, 8);

  const deadline = fourteenDayLimit < businessDayLimit ? fourteenDayLimit : businessDayLimit;
  // If the last day with >7 business days is already before booking, then even
  // on the booking day fewer than 8 business days remain — the law's condition
  // is never met, so the booking is NOT cancelable under it (not "booking day
  // only"). fourteenDayLimit is always ≥ booking, so this means businessDayLimit
  // bound and fell short.
  if (deadline < booking) {
    return { deadline: null, fourteenDayLimit, businessDayLimit, limitedBy: "none" };
  }
  return {
    deadline,
    fourteenDayLimit,
    businessDayLimit,
    limitedBy: deadline === fourteenDayLimit ? "fourteenDays" : "businessDays",
  };
}

/** "yyyy-mm-dd" → "DD/MM/YYYY" (the format the agent reads out to a client). */
export function formatDeadline(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
