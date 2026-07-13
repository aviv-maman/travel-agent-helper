# Database backup & restore

The shared Neon Postgres database is backed up by the **`db-backup`** GitHub Actions workflow in the **backend repo** (`.github/workflows/db-backup.yml`). It lives there — not in the Next repo — because the backend repo is **private**: dumps hold password hashes, session hashes, and client PII, and artifacts on a public repo are downloadable by anyone.

Each run produces a **`pg_dump --format=custom`** file (compressed, portable — restorable into any Postgres, including a different provider) named `neon-YYYY-MM-DD-HHMM.dump`, stored in two places:

| Where | Retention | Purpose |
|---|---|---|
| Supabase Storage — the dedicated **private `backups` bucket** | 12 newest dumps | Long-term, provider-independent of Neon |
| Workflow artifact on the run | 90 days | One-click download from the Actions tab |

> Backups get their **own private bucket** (no MIME restriction) — the quote-images bucket deliberately allows images only, which is exactly why it rejects dump files. Don't loosen that bucket; it polices browser uploads.

## Take a backup whenever you want

GitHub → backend repo → **Actions** tab → **db-backup** → **Run workflow**. That's the on-demand path; no local tooling needed. It also runs automatically on the **1st of every month** (04:00 UTC).

> GitHub pauses scheduled workflows after ~60 days without repo activity — it emails you and one click re-enables them (same caveat as the daily/weekly crons).

## Get a dump file

- **From the run:** open the workflow run → Artifacts → download.
- **From Supabase:** Dashboard → Storage → the `backups` bucket (or via S3: `aws --endpoint-url $SUPABASE_S3_ENDPOINT s3 cp s3://backups/<file> .`).

## Restore (or move to a new database/provider)

You need `pg_restore` **version ≥ 18** (matching what wrote the dump).

```bash
# Inspect what's inside (sanity check — lists every table):
pg_restore --list neon-2026-07-13-0400.dump

# Restore into a brand-new, empty database (new Neon project, RDS, local — anything):
pg_restore --dbname "$NEW_DATABASE_URL" --no-owner --no-privileges neon-2026-07-13-0400.dump

# Re-restore over an existing schema (drops and recreates objects):
pg_restore --dbname "$NEW_DATABASE_URL" --clean --if-exists --no-owner --no-privileges neon-...dump
```

The dump is **full-fidelity**: schema + data + the Drizzle migrations bookkeeping table, so the restored database is immediately usable — no `bun run db:migrate` needed. After moving providers, update `DATABASE_URL` everywhere it lives: the Next repo's `.env.local`, Vercel, Render, the backend `.env`, **and this repo's `DATABASE_URL` Actions secret**.

## Manual local backup (optional)

With PostgreSQL 18 client tools installed locally:

```bash
pg_dump "$DATABASE_URL" --format=custom --file="neon-$(date +%Y-%m-%d).dump"
```

## Required Actions secrets

Documented in the workflow header: `DATABASE_URL`, `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY` (same values as the backend's `.env`), plus `SUPABASE_BACKUP_BUCKET` — the dedicated private backups bucket (created once in the dashboard: Storage → New bucket → private, no MIME restriction). A separate bucket also keeps backups fully out of reach of the weekly quote sweep.
