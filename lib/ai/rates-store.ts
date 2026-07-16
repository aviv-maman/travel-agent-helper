/**
 * Per-browser persistence for the composer's sale exchange rates, so leaving
 * the assistant page and coming back doesn't reset them. localStorage with a
 * freshness window: sale rates are a *daily* working setting, and silently
 * reusing last week's rate is worse than re-entering it — entries older than
 * {@link MAX_AGE_MS} are dropped on load.
 *
 * Client-only (localStorage): call from effects/handlers, never during SSR.
 */

import { CURRENCIES, type Rate } from "@/components/ai/chat-composer";

const KEY = "ai_sale_rates";
/** Half a day — set the rate in the morning, it lasts the workday, gone tomorrow. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

type Stored = { savedAt: number; rates: Rate[] };

/** The saved rates, if fresh — otherwise (missing/stale/corrupt) an empty list. */
export function loadRates(): Rate[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > MAX_AGE_MS ||
      !Array.isArray(parsed.rates)
    ) {
      return [];
    }
    return parsed.rates.filter(
      (r): r is Rate =>
        (CURRENCIES as readonly string[]).includes(r?.currency) && typeof r?.rate === "string",
    );
  } catch {
    return []; // storage unavailable / corrupt JSON — behave as unset
  }
}

/** Persist the current rates (an empty list clears the entry). */
export function storeRates(rates: Rate[]): void {
  try {
    if (rates.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), rates } as Stored));
  } catch {
    // Storage full/blocked — the in-memory state still works for this visit.
  }
}
