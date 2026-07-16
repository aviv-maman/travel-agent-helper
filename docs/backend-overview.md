# Backend overview (the separate Python service)

This Next app has **no API routes**. A small, separate **Python backend** (FastAPI) owns the server responsibilities Next can't or shouldn't do. This is the index; each responsibility has its own contract doc. Copy these docs into the backend repo so it can be built against them.

## The mental model

The backend is a **capability provider**, not a second home for business logic. Auth/session/token logic stays in **Next server actions** (where the custom auth already lives); the backend supplies capabilities Next lacks:

- **Only the backend can:** OAuth callbacks, secret-holding, cron, object storage, calls to paid/keyed APIs, decrypting users' stored AI keys.
- **Next orchestrates, backend supplies one capability:** e.g. *Next* creates a password-reset token + writes the DB; the backend only **sends the email**.

## Topology (shared by all responsibilities)

- **Shared Neon DB.** Backend uses the same `DATABASE_URL`. The Drizzle schema in [`db/schema.ts`](../db/schema.ts) is the source of truth and **Next owns migrations** (`bun run db:migrate`). New columns/tables a backend feature needs are added **in the Next repo first**; the backend only reads/writes them.
- **Same origin.** Deploy behind one origin (reverse proxy): `/api/*` → Python, everything else → Next. Same-origin lets the backend read/set the session **cookie** Next issues (`sha256(token)` = `sessions.id`).
- **Auth check.** Any authenticated backend endpoint validates the `session` cookie exactly as [`lib/auth/session.ts`](../lib/auth/session.ts) does (hash → `sessions.id`, not expired, `mfaPending = false`) → user + role.
- **Secrets that live only on the backend:** OAuth client secrets, the email-provider key, the **AI-key encryption key**, WhatsApp credentials, and Supabase Storage credentials. None of these touch Vercel.
- **Stack:** FastAPI + httpx.

## Responsibilities

Grouped by the phase they're scheduled in (see Phasing). Status is as of 2026-07.

| # | Responsibility | Kind | Contract | Status |
|---|---|---|---|---|
| 1 | Google/Microsoft **OAuth** | HTTP routes | [auth-backend-contract.md](./auth-backend-contract.md) | Google built (provider unwired); Microsoft TODO |
| 2 | **News fetch-proxy** (WAF-blocked publishers) | `GET /fetch?url=` | [news-fetch-proxy.md](./news-fetch-proxy.md) | Next side merged |
| 3 | **Transactional email** | `POST /email/send` | [email-contract.md](./email-contract.md) | Built (provider unwired) |
| 4 | **Password reset + email verification** (email send only; logic in Next) | uses #3 | [password-reset-contract.md](./password-reset-contract.md) | Spec'd |
| 5 | **AI quote assistant** (BYO-key store + vision chat → quote) | routes + Anthropic API | [ai-quote-assistant-contract.md](./ai-quote-assistant-contract.md) | Implemented ⭐ |
| 6 | **File upload** (avatars now; docs/images later) | routes + Supabase Storage | [file-upload-contract.md](./file-upload-contract.md) | Avatar built (provider unwired); presigned PUT /files/sign |
| 7 | **Exchange-rate service** | daily cron → table | [exchange-rate-contract.md](./exchange-rate-contract.md) | Implemented (`POST /cron/fx`; table via Next migration 0013) |
| 8 | **WhatsApp** (send quotes/alerts) | route/worker | [whatsapp-contract.md](./whatsapp-contract.md) | Built (provider unwired; admin-only) |
| 9 | **Scheduled crons** (cleanup, FX, PII sweep, hotel ratings) | cron | see below | Implemented (4 endpoints + GH Actions schedules) |

### 9. Cron jobs
All service-key-authed `POST /cron/*` endpoints, triggered by GitHub Actions workflows in the backend repo (Render's free tier has no scheduler and sleeps — the curl also wakes it):
- **`/cron/cleanup`** (daily) — expired `sessions`, stale `login_attempts`, `audit_log` retention.
- **`/cron/fx`** (daily) — ILS-base exchange rates into `exchange_rates` (see [exchange-rate-contract.md](./exchange-rate-contract.md)).
- **`/cron/quotes`** (Sundays) — PII sweep: saved quotes + their screenshots past retention.
- **`/cron/places`** (Sundays) — refreshes each enriched hotel's Google rating + review count (needs `GOOGLE_PLACES_API_KEY` on the backend; the one-time enrichment runs from the Next repo's `scripts/enrich-hotels-places.ts`).

The backend also sleeps after ~15 min idle; a cron-job.org pinger keeps it warm during working hours (see the backend repo's `docs/render-keep-alive.md`).

## Environment variables Next uses to reach the backend

| Var | Used by | Purpose |
|---|---|---|
| `AUTH_BACKEND_URL` | `oauth-buttons.tsx`, `connected-accounts.tsx` | OAuth endpoints; buttons hide until set |
| `NEWS_FETCH_PROXY` | `lib/news.ts` | Fetch-proxy endpoint; blocked sources go direct until set |
| `BACKEND_URL` | AI chat, email send, uploads, same-origin rewrites | Base URL for the backend (server-to-server; the browser uses the `/api/*` rewrites next.config.ts derives from it) |
| `SERVICE_KEY` | password-reset / verification email sends | Shared secret for `X-Service-Key` calls; must equal the backend's |
| `FILE_UPLOAD_URL` + `SUPABASE_PUBLIC_BASE_URL` | avatar + quote-image uploads | Presign endpoint prefix and the public-bucket base for URL validation |

## Suggested phasing (2026-07)

The backend service itself gates most of this, so standing it up is Phase 0 — with news `/fetch` as the trivial first endpoint that also **proves the host's IP is allowed**. The **AI quote assistant is pulled forward** (top business value) right after Phase 0.

| Phase | What | Notes |
|---|---|---|
| **0 — Foundations** | Stand up backend (news `/fetch` first). **Transactional email** (backend-owned). | Unlocks everything ✉️ and every backend feature. |
| **1 — AI quote assistant** ⭐ | 1a encrypted **BYO-key store** → 1b **quote chat** (image → extract → quote; general prompts; streaming). | Independent of email. Top priority. |
| **2 — Email-verified identity** | **Capture email at registration** + **email verification** ✉️. | Prerequisite for reset; makes `users.email` trustworthy. |
| **3 — Account security** | **Password reset** ✉️ (2FA-required) · **security notifications** ✉️ · **admin send-reset** ✉️ · **emailed invites** ✉️. | Depends on 0 + 2. |
| **4 — Ops cron** | cleanup · audit-log retention. | Cheap, no email. |
| **5 — Domain win** | **exchange-rate service** (daily FX → table → surfaced in commissions). | Small, high daily value. |
| **6 — Comms** | **WhatsApp** (send the generated quote/alerts). | Follows the AI feature. |
| **7 — Advanced** | file upload (avatars) · **Passkeys/WebAuthn**. | Nice-to-have. |
| **Later (backlog)** | news warm-up · invite-expiry reminders · exports · content-pipeline move · Telegram · GDS · payments/billing. | Deferred. |

## Explicitly out of scope (until a feature demands it)
- **Payments/billing, heavy GDS integrations, Telegram** — deferred.
- **SMS 2FA** — TOTP (already built) is strictly better.
- **CAPTCHA** — invite-only + the DB-backed IP throttle in `lib/auth/rate-limit.ts` suffice.
- **Self-hosted SMTP** — use a provider (deliverability).

## Continuing this work with Claude in the backend repo

Claude's memory is **per-project (per folder)** — a new repo starts empty with no history of these chats. Context travels via **these docs**: copy `docs/*.md` (overview + contracts) into the backend repo, then start Claude there with *"read backend-overview.md and the contract docs; let's build responsibility N."*
