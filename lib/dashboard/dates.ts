/**
 * Date helpers for the dashboard, all anchored to Asia/Jerusalem so "today",
 * "overdue" and "days waiting" match the agent's local day regardless of the
 * server/browser timezone. Pure (no deps) — usable on server and client.
 */

const TZ = "Asia/Jerusalem";

// en-CA renders as "yyyy-mm-dd", which sorts and compares as plain strings.
const ISO_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Jerusalem calendar date of `d` (default: now) as "yyyy-mm-dd". */
export function jerusalemDate(d: Date = new Date()): string {
  return ISO_FMT.format(d);
}

/** Today's Jerusalem date as "yyyy-mm-dd". */
export function todayInJerusalem(): string {
  return jerusalemDate();
}

/** Whether an ISO due date ("yyyy-mm-dd") is strictly before today (Jerusalem). */
export function isOverdue(dueDate: string | null | undefined): boolean {
  return Boolean(dueDate) && dueDate! < todayInJerusalem();
}

/** Whether an ISO due date is today (Jerusalem). */
export function isToday(dueDate: string | null | undefined): boolean {
  return Boolean(dueDate) && dueDate! === todayInJerusalem();
}

/** Whether a due date is today or overdue (the "today" task filter). */
export function isTodayOrOverdue(dueDate: string | null | undefined): boolean {
  return Boolean(dueDate) && dueDate! <= todayInJerusalem();
}

/** Whether a timestamp falls on today's Jerusalem date (for "completed today"). */
export function isSameJerusalemDay(d: Date, ref: Date = new Date()): boolean {
  return jerusalemDate(d) === jerusalemDate(ref);
}

export type GreetingKey = "morning" | "afternoon" | "evening" | "night";

const HOUR_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  hour12: false,
});

/** Time-of-day bucket for the greeting, in Jerusalem local time. */
export function greetingKey(d: Date = new Date()): GreetingKey {
  const hour = Number(HOUR_FMT.format(d));
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/** Whole days between the Jerusalem date of `from` and today (≥0). */
export function daysSince(from: Date | string): number {
  const fromIso = typeof from === "string" ? from.slice(0, 10) : jerusalemDate(from);
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${todayInJerusalem()}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
