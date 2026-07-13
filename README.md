# Travel Agent Helper

An internal tool for travel agents: supplier commissions, cancellation fees, transfers, baggage, hotels, airlines, a tourism news feed, an **AI quote assistant** (screenshot → priced client quote, `/assistant`), and a **personal dashboard** (`/dashboard`, the post-login landing page — see [docs/dashboard.md](docs/dashboard.md)) — with invite-only accounts and roles.

Built with Next.js 16 (App Router), next-intl (Hebrew/English), Tailwind + shadcn/ui, Drizzle ORM, and Neon Postgres.

The Next app has **no API routes**. Server capabilities Next can't own (AI chat, OAuth, transactional email, cron, file storage, WhatsApp) live in the sibling **FastAPI backend** ([travel-agent-backend](https://github.com/aviv-maman/travel-agent-backend)); the architecture and per-feature contracts are in [docs/backend-overview.md](docs/backend-overview.md) (mirrored between the two repos).

## Getting started

```bash
bun install
cp .env.example .env.local          # then paste your Neon DATABASE_URL
bun run db:migrate                  # create the tables
bun run seed                        # load hotel data
bun run create-admin myname 'pw'    # bootstrap the first admin
bun run dev
```

The database powers **`/hotels`**, the **content guides** (suppliers, cancellation fees, airlines, transfers, contacts), **auth**, the **dashboard** (per-user tables), **saved AI quotes**, and **exchange rates**. The content pages fall back to their in-code data arrays when no database is configured (code is the source of truth for most content — edit `lib/*.ts`, then `bun run seed`; contacts and supplier commissions/baggage are edited in-app and survive re-seeds). The database is backed up monthly + on demand — see [docs/database-backup.md](docs/database-backup.md). Full setup, the Drizzle migrate/generate/push workflow, and troubleshooting (including the "Failed query … destinations" error) are in **[docs/database-setup.md](docs/database-setup.md)**.

## Useful scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the dev server |
| `bun run db:generate` | Generate a migration after editing `db/schema.ts` |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:studio` | Browse the database |
| `bun run seed` | Load hotel/destination data |
| `bun run create-admin <user> <pass>` | Create/promote an admin |
| `bun run cleanup` | Prune expired sessions and login-attempt rows |

## UI components

shadcn/ui components live in `components/ui`. Add more with:

```bash
npx shadcn@latest add button
```
