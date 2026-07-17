import { expect, test } from "bun:test";
import {
  businessDaysUntil,
  cancellationDeadline,
  formatDeadline,
  isBusinessDay,
  isIsraeliHoliday,
} from "./consumer-law";
import { todayInJerusalem } from "./dashboard/dates";

// --- The two worked examples from the spec -----------------------------------

test("example 1: the 14-day window binds when departure is far off", () => {
  const r = cancellationDeadline("2026-09-01", "2026-07-17")!;
  expect(formatDeadline(r.deadline)).toBe("31/07/2026");
  expect(r.limitedBy).toBe("fourteenDays");
});

test("example 2: the 7-business-day rule binds when departure is close", () => {
  const r = cancellationDeadline("2026-07-27", "2026-07-17")!;
  expect(formatDeadline(r.deadline)).toBe("17/07/2026");
  expect(r.limitedBy).toBe("businessDays");
  // The booking day itself still leaves 8 business days; the next day leaves 7,
  // which is what makes 17/07 the last eligible date rather than 18/07.
  expect(businessDaysUntil("2026-07-17", "2026-07-27")).toBe(8);
  expect(businessDaysUntil("2026-07-18", "2026-07-27")).toBe(7);
});

// --- The business-day definition ---------------------------------------------

test("only Saturdays and official holidays are non-business days", () => {
  expect(isBusinessDay("2026-07-17")).toBe(true); // Friday counts
  expect(isBusinessDay("2026-07-19")).toBe(true); // Sunday counts
  expect(isBusinessDay("2026-07-18")).toBe(false); // Saturday
  expect(isBusinessDay("2026-09-21")).toBe(false); // Yom Kippur (Monday)
});

test("holiday eves are business days", () => {
  expect(isBusinessDay("2026-09-20")).toBe(true); // Yom Kippur eve
  expect(isBusinessDay("2026-09-11")).toBe(true); // Rosh Hashanah eve
  expect(isBusinessDay("2026-04-01")).toBe(true); // Seder night
});

test("fast days and Chol HaMoed are not official rest days", () => {
  expect(isIsraeliHoliday("2026-07-23")).toBe(false); // Tisha B'Av
  expect(isIsraeliHoliday("2026-04-05")).toBe(false); // Chol HaMoed Pesach
  expect(isIsraeliHoliday("2026-03-03")).toBe(false); // Purim
});

// --- The derived holiday calendar, against the real one ----------------------

// Locks ICU's Hebrew calendar to known-correct dates: if a future ICU ever
// renames a month or shifts a conversion, these fail loudly instead of quietly
// handing an agent a wrong legal deadline.
const KNOWN_HOLIDAYS: Record<number, string[]> = {
  2025: [
    "2025-04-13", // Pesach I
    "2025-04-19", // Pesach VII
    "2025-05-01", // Yom HaAtzmaut (5 Iyar fell Sat → Thu)
    "2025-06-02", // Shavuot
    "2025-09-23", // Rosh Hashanah I
    "2025-09-24", // Rosh Hashanah II
    "2025-10-02", // Yom Kippur
    "2025-10-07", // Sukkot
    "2025-10-14", // Shmini Atzeret
  ],
  2026: [
    "2026-04-02",
    "2026-04-08",
    "2026-04-22", // Yom HaAtzmaut (5 Iyar fell Wed → no shift)
    "2026-05-22",
    "2026-09-12",
    "2026-09-13",
    "2026-09-21",
    "2026-09-26",
    "2026-10-03",
  ],
  2027: [
    "2027-04-22",
    "2027-04-28",
    "2027-05-12",
    "2027-06-11",
    "2027-10-02",
    "2027-10-03",
    "2027-10-11",
    "2027-10-16",
    "2027-10-23",
  ],
};

test("derives exactly the nine official rest days per year", () => {
  for (const [year, expected] of Object.entries(KNOWN_HOLIDAYS)) {
    const found: string[] = [];
    const d = new Date(Date.UTC(Number(year), 0, 1, 12));
    while (d.getUTCFullYear() === Number(year)) {
      const iso = d.toISOString().slice(0, 10);
      if (isIsraeliHoliday(iso)) found.push(iso);
      d.setUTCDate(d.getUTCDate() + 1);
    }
    expect(found).toEqual(expected);
  }
});

test("Independence Day observes its shift rules", () => {
  expect(isIsraeliHoliday("2024-05-14")).toBe(true); // 5 Iyar Mon → Tue
  expect(isIsraeliHoliday("2024-05-13")).toBe(false);
  expect(isIsraeliHoliday("2025-05-01")).toBe(true); // 5 Iyar Sat → Thu
  expect(isIsraeliHoliday("2025-05-03")).toBe(false);
  expect(isIsraeliHoliday("2029-04-19")).toBe(true); // 5 Iyar Fri → Thu
  expect(isIsraeliHoliday("2029-04-20")).toBe(false);
  expect(isIsraeliHoliday("2028-05-02")).toBe(true); // 5 Iyar Mon → Tue
});

// --- Deadline edge cases ------------------------------------------------------

test("holidays before departure pull the deadline earlier", () => {
  // Departure just after Sukkot week 2026: the run of rest days means the 8th
  // business day back lands further from departure than a plain weekday count.
  const r = cancellationDeadline("2026-10-05", "2026-09-20")!;
  expect(r.limitedBy).toBe("businessDays");
  expect(businessDaysUntil(r.deadline, "2026-10-05")).toBe(8);
  // One day later must drop to exactly 7 — the boundary the law turns off at.
  const next = new Date(`${r.deadline}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  expect(businessDaysUntil(next.toISOString().slice(0, 10), "2026-10-05")).toBe(7);
});

test("a departure too close to book leaves only the booking date", () => {
  const r = cancellationDeadline("2026-07-22", "2026-07-17")!;
  expect(formatDeadline(r.deadline)).toBe("17/07/2026");
  expect(r.limitedBy).toBe("bookingDate");
  // The law genuinely does not protect this booking — fewer than 8 business
  // days remain even on day one.
  expect(businessDaysUntil("2026-07-17", "2026-07-22")).toBeLessThan(8);
});

test("leap day is an ordinary business day and spans correctly", () => {
  expect(isBusinessDay("2028-02-29")).toBe(true); // Tuesday
  const r = cancellationDeadline("2028-06-01", "2028-02-20")!;
  expect(formatDeadline(r.deadline)).toBe("05/03/2028"); // 20/02 + 14 crosses 29/02
});

test("departure on or before the booking date has no window", () => {
  expect(cancellationDeadline("2026-07-17", "2026-07-17")).toBeNull();
  expect(cancellationDeadline("2026-07-16", "2026-07-17")).toBeNull();
  expect(cancellationDeadline("", "2026-07-17")).toBeNull();
});

test("booking date defaults to today in Jerusalem", () => {
  const far = new Date();
  far.setUTCFullYear(far.getUTCFullYear() + 1);
  const departure = far.toISOString().slice(0, 10);

  const today = todayInJerusalem();
  const implicit = cancellationDeadline(departure)!;
  expect(implicit).toEqual(cancellationDeadline(departure, today)!);
  // A year out the 14-day window always binds, so the deadline is today + 14.
  const plus14 = new Date(`${today}T12:00:00Z`);
  plus14.setUTCDate(plus14.getUTCDate() + 14);
  expect(implicit.limitedBy).toBe("fourteenDays");
  expect(implicit.deadline).toBe(plus14.toISOString().slice(0, 10));
});

test("formatDeadline renders DD/MM/YYYY", () => {
  expect(formatDeadline("2026-07-31")).toBe("31/07/2026");
  expect(formatDeadline("2026-01-05")).toBe("05/01/2026");
});
