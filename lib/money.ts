/**
 * Converts the editorial transport prices (kept in their local currency, e.g.
 * "~25–35₾") into Israeli shekels for display. Rates are fetched live once a
 * day and cached by Next; if the network call fails we fall back to the
 * approximate constants below so a price is always shown.
 *
 * "Close enough" by design — these are ballpark transport costs, not quotes.
 */

/** Map the currency symbols/codes used in the data to ISO 4217 codes. */
const CODE_BY_TOKEN: { test: RegExp; code: string }[] = [
  { test: /₾/, code: "GEL" }, // Georgian lari
  { test: /€/, code: "EUR" },
  { test: /\$/, code: "USD" },
  { test: /\bBGN\b/, code: "BGN" }, // Bulgarian lev
  { test: /\bRON\b/, code: "RON" }, // Romanian leu
  { test: /\bPLN\b|\bzł\b/, code: "PLN" }, // Polish zloty
  { test: /\bAZN\b|₼/, code: "AZN" }, // Azerbaijani manat
  { test: /\bHUF\b|\bFt\b/, code: "HUF" }, // Hungarian forint
  { test: /\bCZK\b|Kč/, code: "CZK" }, // Czech koruna
];

/**
 * ILS per 1 unit of currency — fallback when the live API is unreachable. The
 * keys are also the canonical currency list the daily refresh fetches; keep in
 * sync with the Vercel cron ({@link FX_CURRENCIES}) and the destination data.
 */
const FALLBACK_RATES: Record<string, number> = {
  EUR: 4.0,
  USD: 3.7,
  GEL: 1.35,
  BGN: 2.05,
  RON: 0.8,
  PLN: 0.93,
  AZN: 1.77,
  HUF: 0.0093,
  CZK: 0.16,
};

/** Every currency the app converts — the single source the FX cron refreshes. */
export const FX_CURRENCIES = Object.keys(FALLBACK_RATES);

export type IlsRates = Record<string, number>;

/** The rates plus when they were last refreshed (null = hard-coded fallback). */
export type IlsRatesMeta = { rates: IlsRates; fetchedAt: Date | null };

/**
 * "ILS per 1 unit" rates for every currency we display. Three tiers, best first
 * (docs/exchange-rate-contract.md):
 *   1. the `exchange_rates` table the Python backend's daily `/cron/fx` refreshes
 *      (pure DB read — no request-time third-party call),
 *   2. a live fetch from the free open.er-api.com endpoint (daily revalidate),
 *   3. the approximate {@link FALLBACK_RATES} constants.
 * Always resolves. NOTE: the backend job refreshes the same currency list —
 * keep FALLBACK_RATES keys and the backend's FX_CURRENCIES in sync.
 */
export async function getIlsRatesWithMeta(): Promise<IlsRatesMeta> {
  const codes = FX_CURRENCIES;

  // 1. The table the daily cron keeps fresh. Rows store "quote units per 1
  //    ILS" (base=ILS) — invert for ILS-per-unit. `fetchedAt` is when the cron
  //    last wrote. Falls through when the table is empty (cron hasn't run yet)
  //    or unreachable. Dynamic import keeps this module usable in contexts
  //    without DATABASE_URL (db/index.ts throws at load).
  try {
    const { db, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(schema.exchangeRates)
      .where(eq(schema.exchangeRates.base, "ILS"));
    if (rows.length > 0) {
      const out: IlsRates = { ...FALLBACK_RATES };
      let fetchedAt: Date | null = null;
      for (const row of rows) {
        const code = row.quote.trim();
        const perIls = Number(row.rate);
        if (codes.includes(code) && perIls > 0) out[code] = 1 / perIls;
        if (row.fetchedAt && (!fetchedAt || row.fetchedAt > fetchedAt)) fetchedAt = row.fetchedAt;
      }
      return { rates: out, fetchedAt };
    }
  } catch {
    // fall through to the live fetch
  }

  // 2. Live fetch (used until the cron first populates the table). The provider
  //    reports when it last refreshed its own rates — surface that as fetchedAt.
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/ILS", {
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`rates HTTP ${res.status}`);
    const json = (await res.json()) as {
      rates?: Record<string, number>;
      time_last_update_unix?: number;
    };
    const perIls = json.rates ?? {};
    const out: IlsRates = {};
    for (const code of codes) {
      // perIls[code] = units of `code` per 1 ILS → invert for ILS per unit.
      out[code] = perIls[code] ? 1 / perIls[code] : FALLBACK_RATES[code];
    }
    const fetchedAt = json.time_last_update_unix
      ? new Date(json.time_last_update_unix * 1000)
      : new Date();
    return { rates: out, fetchedAt };
  } catch {
    return { rates: { ...FALLBACK_RATES }, fetchedAt: null };
  }
}

/** Just the rates map (see {@link getIlsRatesWithMeta} for the timestamp). */
export async function getIlsRates(): Promise<IlsRates> {
  return (await getIlsRatesWithMeta()).rates;
}

/** Friendly rounding: 1 decimal under 3, whole under 20, nearest 5 above. */
function nice(v: number): string {
  if (v < 3) return (Math.round(v * 10) / 10).toString();
  if (v < 20) return Math.round(v).toString();
  return (Math.round(v / 5) * 5).toString();
}

/**
 * Converts a local-currency price string to an ILS string, e.g.
 * "~25–35₾" → "~95–135 ₪". Returns undefined for unrecognized currencies.
 */
export function toIls(price: string, rates: IlsRates): string | undefined {
  const code = CODE_BY_TOKEN.find((c) => c.test.test(price))?.code;
  const rate = code ? rates[code] : undefined;
  if (!rate) return undefined;

  const nums = price.match(/\d+(?:\.\d+)?/g);
  if (!nums) return undefined;

  const approx = /~/.test(price);
  const ils = nums.map((n) => nice(parseFloat(n) * rate)).join("–");
  return `${approx ? "~" : ""}${ils} ₪`;
}

/** Strips a leading "~" so the original can sit cleanly inside parentheses. */
export function stripApprox(price: string): string {
  return price.replace(/^~\s*/, "");
}

/**
 * Splits a destination's editorial currency note ("<lead>: <name> (<CODE>) ·
 * <stale rate>") into its descriptive label and a LIVE rate line computed from
 * `rates`. Shows whichever side reads ≥ 1 ("1 € ≈ ₪4" for strong currencies,
 * "₪1 ≈ 107 forint" for weak ones). Returns null when the note carries no ISO
 * code or we have no rate for it — the caller then shows the raw note.
 */
export function buildCurrencyLine(
  note: string,
  rates: IlsRates,
): { label: string; rate: string } | null {
  const code = note.match(/\(([A-Z]{3})\)/)?.[1];
  const perUnit = code ? rates[code] : undefined;
  if (!code || !perUnit) return null;
  const label = note.split("·")[0].trim();
  // Currency name = the words between the first ":" and the "(CODE)".
  const name = label.match(/:\s*(.+?)\s*\(/)?.[1]?.trim() || code;
  // Exchange-rate precision (2 decimals under 20, whole above) — unlike nice(),
  // which is tuned for ballpark transport prices and would drop ₪3.48 to ₪3.
  const fmt = (v: number) => (v >= 20 ? String(Math.round(v)) : String(Math.round(v * 100) / 100));
  const rate =
    perUnit >= 1
      ? `1 ${name} ≈ ₪${fmt(perUnit)}` // stronger than the shekel
      : `₪1 ≈ ${fmt(1 / perUnit)} ${name}`; // weaker
  return { label, rate };
}
