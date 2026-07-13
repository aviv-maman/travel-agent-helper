# Dashboard — the login-gated personal homepage

`/{locale}/dashboard` is each agent's personal work homepage and the **default post-login landing page** (`safeNext()` in [`lib/auth/protected-routes.ts`](../lib/auth/protected-routes.ts) falls back to it). It is auth-gated via `PROTECTED_PREFIXES` (middleware first pass) + `requireUser` in the page (the real boundary). All data is **per-user** — unlike the shared content pages (suppliers, hotels, …), nothing here is visible to other users.

**Frontend-only feature.** Data lives in Neon via Drizzle (Next owns the schema, as always); the Python backend never touches these tables. Shipped 2026-07 (PRs #153–#155, migrations `drizzle/0017`–`0019`).

## What's on it

A time-of-day greeting (Jerusalem clock, `lib/dashboard/dates.ts`) leads; two tabs below ([`components/dashboard/dashboard-view.tsx`](../components/dashboard/dashboard-view.tsx)):

- **Workspace tab** — the scratchpad (above the tasks), a quick-add control, the four task sections, today's completed items, and quick links.
- **Bank tab** — the agent's bank-transfer details card with one-tap copy for WhatsApp.

### Task board

Typed to how a travel agent actually waits on things — four sections by `type`: `task`, `awaiting_supplier`, `client_followup`, `reminder`. Each task can carry a client name/phone, supplier name, booking/order number, due date, and notes.

- **Per-section quick add** (`add-item-popover.tsx`) plus a full edit dialog (`task-edit-dialog.tsx`).
- **Drag & drop** within and across sections; order persists via `sort_order` (+ the item's possibly-new `type`), written in one batch by `reorderTasksAction` (≤300 updates).
- **Client phone → actions** (`phone-actions.tsx`): stored in international format (`+9725…`) specifically so `wa.me` links work.
- **Lifecycle:** `open` → `done` (reopenable) → `archived`. Completing stamps `completedAt`; the page's load-time housekeeping (`archiveStaleCompleted`) auto-archives items done more than 7 days ago, so the "completed" list stays short without the user managing it.

### Scratchpad ("Playground")

One free-form text area per user, upserted on save (`dashboard_scratchpad` — a single row keyed by `user_id`). It doubles as a **Soulver/Numi-style line calculator** ([`lib/dashboard/calc.ts`](../lib/dashboard/calc.ts)): each line that parses as an expression shows a result, including contextual percent shorthand (`2500 + 8%` → 2700). The evaluator is a safe hand-rolled recursive-descent parser — never `eval` on user input. Tested in `lib/dashboard/calc.test.ts`.

### Bank details

Stored in `dashboard_settings`, a per-user **key/value** table (`(user_id, key)` PK) — bank/branch/account/beneficiary today; any future single-value user setting can reuse the table. The key list + types live in the client-safe [`lib/dashboard/bank.ts`](../lib/dashboard/bank.ts) so the card and the server DAL share them.

## Where the code lives

| Layer | Location |
|---|---|
| Page (server) | [`app/[locale]/dashboard/page.tsx`](../app/%5Blocale%5D/dashboard/page.tsx) — `requireUser`, housekeeping, parallel fetch, maps rows to the client `DashTask` shape |
| Server actions | [`app/actions/dashboard.ts`](../app/actions/dashboard.ts) — every action re-resolves the session, then writes through the DAL |
| DAL (server-only) | `lib/dashboard/tasks.ts`, `scratchpad.ts`, `settings.ts` — all queries scoped by `userId` |
| Client components | `components/dashboard/` — `dashboard-view` (orchestrator), `task-board`, `task-section`, `task-card`, `task-edit-dialog`, `add-item-popover`, `playground`, `bank-details-card`, `greeting`, `phone-actions` |
| Schema | [`db/schema.ts`](../db/schema.ts) — `dashboardTasks`, `dashboardScratchpad`, `dashboardSettings` (+ the two enums) |
| i18n | `messages/*.json` under the `dashboard` namespace |

## Tables (migrations 0017–0019)

- **`dashboard_tasks`** — `id uuid` PK; `user_id` FK (cascade delete); `title`; optional `client_name`, `client_phone`, `supplier_name`, `order_number` (0018), `due_date`, `notes`; `type` + `status` enums; `sort_order` (0019, manual DnD position — ties broken by `created_at`); `created_at`, `completed_at`. Indexed on `(user_id, status)`.
- **`dashboard_scratchpad`** — one row per user (`user_id` PK), `content`, `updated_at`.
- **`dashboard_settings`** — `(user_id, key)` PK, `value`.

## The scroll-preservation rule (important when extending)

None of the dashboard server actions call `revalidatePath`: the page is dynamic (it reads the session cookie), and applying a revalidated tree from inside an action **resets the scroll position**. Instead each client component calls `router.refresh()` after a successful action — fresh data, scroll intact. Keep new actions on this pattern (see the header comment in `app/actions/dashboard.ts`).
