# Exchange-rate service contract

A **daily cron** refreshes foreign-exchange rates into the DB so the app shows live conversions (the city currency line, transport prices) instead of a hard-coded note. Read path is pure DB — no request-time third-party call.

**Owner: the Next app (Vercel Cron).** `GET /api/cron/fx` (see `vercel.json`, daily 05:00 UTC) fetches ILS-base rates from open.er-api.com for `FX_CURRENCIES` (`lib/money.ts`) and upserts them with a fresh `fetched_at`. Protected by `CRON_SECRET`. The city panel surfaces `fetched_at` as a "last updated" line. The backend also ships a `/cron/fx` (open.er-api.com too) from before this moved into Next; either can write the shared table (idempotent upsert) — the Vercel job is the current source of truth and covers the full currency list (incl. HUF, CZK).

## Schema (added in the Next repo — Next owns migrations)

`exchange_rates`:
- `base` (char(3), e.g. `ILS`), `quote` (char(3), e.g. `USD`), `rate` (numeric), `fetchedAt` (timestamptz).
- Primary key `(base, quote)` — one current row per pair (upsert), or append rows if you want history.

## The job

- **Daily cron** (see [backend-overview.md](./backend-overview.md) §cron). Fetch from a free FX API (e.g. exchangerate.host / open.er-api.com — no key, or a keyed provider stored backend-side), for the currencies the app uses (ILS base; USD, EUR, GEL, … quotes).
- **Upsert** each pair with the new `rate` + `fetchedAt`. Idempotent; safe to re-run.
- On fetch failure, **leave the last good rows in place** (don't null them) and log — stale rates beat no rates.

## Read path (Next)

A server helper `getIlsRates()` (`lib/money.ts`) reads all `base = ILS` rows in one query and inverts them to ₪-per-unit; consumers convert via `toIls()` (e.g. hotel transport pricing in `lib/hotels.ts`). `fetchedAt` is stored but not currently surfaced in the UI. No env var / backend URL needed at request time — the backend only writes.

## Notes
- Keep the currency list in one place (config) shared with the content that needs conversion.
- Rates are advisory (display/estimate), not booking-grade — note that in the UI.
