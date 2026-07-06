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
| 1 | Google/Microsoft **OAuth** | HTTP routes | [auth-backend-contract.md](./auth-backend-contract.md) | Spec'd |
| 2 | **News fetch-proxy** (WAF-blocked publishers) | `GET /fetch?url=` | [news-fetch-proxy.md](./news-fetch-proxy.md) | Next side merged |
| 3 | **Transactional email** | `POST /email/send` | [email-contract.md](./email-contract.md) | Spec'd |
| 4 | **Password reset + email verification** (email send only; logic in Next) | uses #3 | [password-reset-contract.md](./password-reset-contract.md) | Spec'd |
| 5 | **AI quote assistant** (BYO-key store + vision chat → quote) | routes + Anthropic API | [ai-quote-assistant-contract.md](./ai-quote-assistant-contract.md) | Spec'd ⭐ |
| 6 | **File upload** (avatars now; docs/images later) | routes + Supabase Storage | [file-upload-contract.md](./file-upload-contract.md) | Proposed |
| 7 | **Exchange-rate service** | daily cron → table | [exchange-rate-contract.md](./exchange-rate-contract.md) | Proposed |
| 8 | **WhatsApp** (send quotes/alerts) | route/worker | [whatsapp-contract.md](./whatsapp-contract.md) | Proposed |
| 9 | **Scheduled cleanup + audit retention** | cron | see below | Anticipated |

### 9. Cron jobs
- **Cleanup:** delete expired `sessions` + stale `loginAttempts` — logic already in [`scripts/cleanup.ts`](../scripts/cleanup.ts), run daily.
- **Audit-log retention:** delete audit rows older than the retention window (e.g. 12 months).

## Environment variables Next uses to reach the backend

| Var | Used by | Purpose |
|---|---|---|
| `AUTH_BACKEND_URL` | `oauth-buttons.tsx`, `connected-accounts.tsx` | OAuth endpoints; buttons hide until set |
| `NEWS_FETCH_PROXY` | `lib/news.ts` | Fetch-proxy endpoint; blocked sources go direct until set |
| `BACKEND_URL` *(planned)* | email send, AI chat, uploads | Base URL for the newer endpoints (server-to-server; browser can use same-origin relative paths) |

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
