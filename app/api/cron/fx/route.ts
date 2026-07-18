import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { FX_CURRENCIES } from "@/lib/money";

/**
 * Daily FX refresh (Vercel Cron — see vercel.json). Fetches ILS-base rates from
 * the free, key-less open.er-api.com for every currency the app converts
 * ({@link FX_CURRENCIES}) and upserts them into `exchange_rates` with a fresh
 * `fetched_at`. The read path (`lib/money.ts`) then serves live rates and the
 * city panel shows the "last updated" time.
 *
 * On provider failure nothing is written — the last good rows stay in place
 * (stale rates beat no rates). Idempotent; safe to re-run.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is
  // configured. Require it so the endpoint can't be triggered by the public.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { rates?: Record<string, number> };
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/ILS", { cache: "no-store" });
    if (!res.ok) throw new Error(`FX provider HTTP ${res.status}`);
    payload = await res.json();
  } catch (err) {
    // Keep the last good rows; report the failure.
    return Response.json(
      { error: "FX provider unavailable — kept previous rates", detail: String(err) },
      { status: 502 },
    );
  }

  // rates[code] = units of `code` per 1 ILS (base=ILS), which is exactly what
  // the table stores (`rate` = quote units per base unit).
  const rates = payload.rates ?? {};
  const rows = FX_CURRENCIES.filter((code) => rates[code] && rates[code] > 0).map((code) => ({
    base: "ILS",
    quote: code,
    rate: String(rates[code]),
  }));

  if (rows.length === 0) {
    return Response.json({ error: "no usable rates returned", updated: 0 }, { status: 502 });
  }

  await db
    .insert(schema.exchangeRates)
    .values(rows)
    .onConflictDoUpdate({
      target: [schema.exchangeRates.base, schema.exchangeRates.quote],
      set: { rate: sql`excluded.rate`, fetchedAt: sql`now()` },
    });

  const missing = FX_CURRENCIES.filter((code) => !rates[code]);
  return Response.json({ base: "ILS", updated: rows.length, missing });
}
