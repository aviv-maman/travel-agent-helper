# Travel Agent Helper

An internal tool for travel agents: supplier commissions, cancellation fees, transfers, baggage, hotels, and a tourism news feed — with invite-only accounts and roles.

Built with Next.js 16 (App Router), next-intl (Hebrew/English), Tailwind + shadcn/ui, Drizzle ORM, and Neon Postgres.

## Getting started

```bash
bun install
cp .env.example .env.local          # then paste your Neon DATABASE_URL
bun run db:migrate                  # create the tables
bun run seed                        # load hotel data
bun run create-admin myname 'pw'    # bootstrap the first admin
bun run dev
```

The database powers **`/hotels`** and **auth**; the other pages work without it. Full setup, the Drizzle migrate/generate/push workflow, and troubleshooting (including the "Failed query … destinations" error) are in **[docs/database-setup.md](docs/database-setup.md)**.

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
