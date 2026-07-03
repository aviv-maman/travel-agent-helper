# Database setup

The app uses **[Neon](https://neon.tech) (serverless Postgres)** with **[Drizzle ORM](https://orm.drizzle.team)**. Two areas need the database:

- **Hotels** (`/hotels`) — reads `destinations`, `hotels`, and related tables.
- **Auth** — `users`, `sessions`, `invitations`, `login_attempts`.

Everything else (suppliers, transfers, airlines, cancellation fees, news) reads local data files or external sources, so it works with no database at all.

> **The error you saw** (`Failed query: select … from "destinations" …` on `/hotels`) means the connection worked but the **tables don't exist yet** — you set `DATABASE_URL` but never applied the migrations. Steps 2–3 below fix it.

Run the commands with **`bun run …`** (not `npm run`): this is a Bun project, and Bun automatically loads `.env.local` into the environment, which the Drizzle commands need.

---

## 1. Set the connection string

1. In the Neon console: **Project → Connection Details → "Pooled connection"** (the host contains `-pooler`). Pooled is the right one for a serverless app.
2. Copy `.env.example` to `.env.local` and paste your string:

   ```bash
   # .env.local
   DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require"
   ```

   - `?sslmode=require` is mandatory for Neon.
   - `.env.local` is git-ignored — secrets never get committed.
   - Next.js and Bun both load `.env.local` automatically; you never read the file manually.

## 2. Create the tables (apply migrations)

```bash
bun install          # once, if you haven't installed deps
bun run db:migrate   # creates every table from the files in drizzle/
```

This runs each SQL file in `drizzle/` in order (`0000_…` → `0005_…`), building the whole schema: hotels data **and** the auth tables. After this, `/hotels` stops erroring (it'll just be empty until step 3).

## 3. Load the hotel data (seed)

```bash
bun run seed
```

Populates `destinations`, `hotels`, `landmarks`, etc. from the source data. It's **idempotent** — safe to run again; it upserts destinations and replaces each destination's hotels. Now `/hotels` shows real content.

## 4. Create your first admin (auth bootstrap)

Registration is invite-only, so there's a chicken-and-egg problem for the very first user. This script solves it:

```bash
bun run create-admin myname 'a-strong-password'
```

Creates (or promotes) that user as an **admin**. Log in at `/en/login` (or `/he/login`), then everyone else self-registers with invite codes you generate under **Manage invites**.

## 5. Run the app

```bash
bun run dev
```

Visit `/hotels` (data), `/en/login` (sign in), `/en/admin/users`, `/en/admin/invites`.

---

## How the Drizzle workflow works

The schema is defined **in TypeScript** in [`db/schema.ts`](../db/schema.ts) — that's the source of truth. Three commands turn it into a real database:

| Command | What it does | When |
| --- | --- | --- |
| `bun run db:generate` | Diffs `schema.ts` against the existing migrations and writes a new SQL file to `drizzle/`. **Offline** — no DB needed. | After you change `schema.ts`. |
| `bun run db:migrate` | Runs the pending `drizzle/*.sql` files against the database, recording which ran. | To apply schema changes (incl. first setup). |
| `bun run db:push` | Shortcut that syncs `schema.ts` straight to the DB **without** creating migration files. | Quick local experiments only. |
| `bun run db:studio` | Opens Drizzle Studio, a browser UI to view/edit rows. | To inspect data. |

**This project uses the migrate flow** (generate → commit the SQL → migrate), because the `drizzle/` files are a reviewable, replayable history of the schema — the right choice for anything heading to production. `db:push` is convenient in dev but leaves no history (it's how the `aparthotel` enum value once drifted).

The typical change loop:

```
edit db/schema.ts  →  bun run db:generate  →  review drizzle/000X_*.sql  →  bun run db:migrate
```

## Maintenance

- `bun run cleanup` — deletes expired sessions and stale login-attempt rows. Schedule it (a daily cron) so those tables don't grow forever.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Failed query: select … from "destinations"` | Tables not created | `bun run db:migrate` |
| `/hotels` loads but is empty | Tables exist, no data | `bun run seed` |
| `DATABASE_URL is not set` | `.env.local` missing or command run without Bun | Create `.env.local`; use `bun run …` |
| Connection/timeout error | Wrong string or missing `?sslmode=require` | Re-copy the **Pooled** string from Neon |
| Can't log in / register asks for a code | No admin yet | `bun run create-admin <user> <pass>` |
