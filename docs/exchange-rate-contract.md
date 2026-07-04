# Exchange-rate service contract

A backend **cron** that refreshes foreign-exchange rates into the DB so the app can show live conversions (commissions, prices) instead of the hard-coded note (`1 Lari ≈ ₪1.09`). Read path is pure DB — Next needs no request-time backend call.

## Schema (added in the Next repo — Next owns migrations)

`exchange_rates`:
- `base` (char(3), e.g. `ILS`), `quote` (char(3), e.g. `USD`), `rate` (numeric), `fetchedAt` (timestamptz).
- Primary key `(base, quote)` — one current row per pair (upsert), or append rows if you want history.

## The job

- **Daily cron** (see [backend-overview.md](./backend-overview.md) §cron). Fetch from a free FX API (e.g. exchangerate.host / open.er-api.com — no key, or a keyed provider stored backend-side), for the currencies the app uses (ILS base; USD, EUR, GEL, … quotes).
- **Upsert** each pair with the new `rate` + `fetchedAt`. Idempotent; safe to re-run.
- On fetch failure, **leave the last good rows in place** (don't null them) and log — stale rates beat no rates.

## Read path (Next)

A server helper `getRate(base, quote)` reads the row; UI shows `fetchedAt` so users know freshness. No env var / backend URL needed at request time — the backend only writes.

## Notes
- Keep the currency list in one place (config) shared with the content that needs conversion.
- Rates are advisory (display/estimate), not booking-grade — note that in the UI.
