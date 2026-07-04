# Backend overview (the separate Python service)

This Next app has **no API routes**. A small, separate **Python backend** owns the few server responsibilities that Next can't (or shouldn't) do itself. This is the index; each responsibility has its own contract doc. Copy these docs into the backend repo so it can be built against them.

## Why a separate service at all

- **OAuth** needs provider callbacks, client secrets, and a place to set the session cookie — none of which belong in a static-first Next app with no API routes.
- **News fetching** for a few publishers must egress from an **allowed (non-datacenter) IP**; Vercel's IP is blocked. See [news-fetch-proxy.md](./news-fetch-proxy.md).
- **Cron** (periodic cleanup) needs a scheduler.
- **File upload** (planned) needs object storage + signing.

## Topology (shared by all responsibilities)

- **Shared Neon DB.** The backend connects to the **same** `DATABASE_URL`. The Drizzle schema in [`db/schema.ts`](../db/schema.ts) is the source of truth and **Next owns migrations** (`bun run db:migrate`). The backend only reads/writes existing tables; it never runs migrations. New columns a backend feature needs (e.g. an image URL) are added to the schema **in the Next repo** first.
- **Same origin.** Deploy behind one origin (a reverse proxy): `/api/*` (or `/auth/*`) → Python, everything else → Next. Same-origin is what lets the backend set/read the session **cookie** Next issues (`sha256(cookie token)` = `sessions.id`). Cross-origin breaks cookie sharing.
- **Auth check.** Any authenticated backend endpoint validates the Next `session` cookie the same way `lib/auth/session.ts` does: hash the token, look up `sessions.id`, ensure not expired and `mfaPending = false`; then map to the user (and role, for permission checks).
- **Suggested stack:** FastAPI + httpx (matches the news-proxy reference implementation).

## Responsibilities

| # | Responsibility | Kind | Contract | Status |
|---|---|---|---|---|
| 1 | Google/Microsoft OAuth (login / register / link / unlink) | HTTP routes | [auth-backend-contract.md](./auth-backend-contract.md) | Spec'd; not built |
| 2 | News fetch-proxy for WAF-blocked publishers | HTTP route (`GET /fetch?url=`) | [news-fetch-proxy.md](./news-fetch-proxy.md) | Next side merged; backend not built |
| 3 | File upload (avatars now; documents/images later) | HTTP route(s) + Cloudflare R2 | [file-upload-contract.md](./file-upload-contract.md) | Proposed |
| 4 | Scheduled cleanup (expired sessions, stale login-attempt rows) | Cron job | see below | Anticipated |

### 4. Scheduled cleanup (cron)

The delete logic already exists as [`scripts/cleanup.ts`](../scripts/cleanup.ts) (removes expired `sessions` and stale `loginAttempts`). It's safe to run any time and idempotent. The backend should run the equivalent on a daily schedule (a cron/APScheduler job, or the host's scheduler hitting a small protected endpoint). No new tables. Keep the exact delete conditions in sync with `scripts/cleanup.ts` (or have the cron just shell out to `bun run cleanup` if the backend host has Bun).

## Environment variables the Next app uses to reach the backend

| Var | Used by | Purpose |
|---|---|---|
| `AUTH_BACKEND_URL` | `oauth-buttons.tsx`, `connected-accounts.tsx` | Base URL of OAuth endpoints; buttons hide until set |
| `NEWS_FETCH_PROXY` | `lib/news.ts` | Full URL of the fetch-proxy endpoint; blocked sources fetched directly until set |
| `FILE_UPLOAD_URL` *(planned)* | file-upload feature | Base URL of the upload signing endpoint |

## Explicitly out of scope (until a feature needs it)

- **Email / SMTP** — no password reset, no email invites (invites are code-based). Don't build it speculatively.
- **Rate limiting** — already handled in Next, DB-backed (`lib/auth/rate-limit.ts`). The backend only helps by running the cron that trims its rows (#4).

## Continuing this work with Claude in the backend repo

Claude's memory is **per-project (per folder)** — a new repo starts with empty memory and no history of these chats. So context travels via **these docs**: copy `docs/*-contract.md` + this overview into the backend repo, then start Claude there with *"read backend-overview.md and the contract docs; let's build endpoint N."* That's enough to continue with full context.
