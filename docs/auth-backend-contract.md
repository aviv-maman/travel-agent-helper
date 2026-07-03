# Auth backend contract (OAuth: Google & Microsoft)

OAuth sign-in is handled by a **separate Python backend**, not by this Next app (which has no API routes). This document is the contract the backend must honor so the Next app's existing session mechanism keeps working unchanged.

## Topology

- **Shared database.** The backend connects to the **same Neon DB** (`DATABASE_URL`). The Drizzle schema in [`db/schema.ts`](../db/schema.ts) is the source of truth; **Next owns migrations** (`bun run db:migrate`). The backend only reads/writes the existing tables (`users`, `accounts`, `sessions`, `invitations`).
- **Same origin.** Deploy behind one origin (reverse proxy): `/api/*` (or `/auth/*`) → Python, everything else → Next. This is what lets the backend set the session **cookie** that Next reads. Cross-origin would break cookie sharing.
- Next points at the backend via `AUTH_BACKEND_URL` (e.g. `https://app.example.com/api`). Until it's set, the "Continue with…" buttons don't render.

## Endpoints the Next UI links to

`GET {AUTH_BACKEND_URL}/auth/{provider}/start` with query params:
- `mode` = `login` | `register` | `link`
- `locale` = `en` | `he` (where to return the user)
- `code` = invite code (present in `register` mode; see gating)

`{provider}` ∈ `google`, `microsoft`. The backend also owns the provider **callback** URL (register it with Google/Microsoft). Google returns via `GET`, Microsoft via `GET` (OIDC auth-code). Use `state` + PKCE for CSRF.

## Flows

Verify the OIDC **id_token** obtained from the provider's token endpoint (trusted TLS channel) for `sub`, `email`, `email_verified`. Require `email_verified`. Identify the user by `accounts.(provider, providerAccountId=sub)`.

- **login:** look up `accounts` by `(provider, sub)`. If found → **session handoff** for that user. If not found → redirect back to `/{locale}/login` with an error (no linked account; they must register with an invite or link it while signed in).
- **register (invite-gated):** require `code`. Validate against `invitations` (must be *active*: not used/revoked/expired). Then, in effect atomically (mirror `register()` in [`lib/auth/actions.ts`](../lib/auth/actions.ts)): create a `users` row (role = the invite's role; `email` = verified email; `passwordHash` = **NULL**; `username` = derived, see below), create an `accounts` row `(userId, provider, sub, email)`, and mark the invite `usedAt/usedBy`. If the invite lost validity in the race, roll back. Then session handoff.
- **link:** the user is already signed in (a valid Next `session` cookie — the backend validates it the same way: `sha256(cookie token)` = `sessions.id`, not expired). Insert an `accounts` row for the current user. Reject if that `(provider, sub)` is already linked to a different user. Return to `/{locale}/account/security`.

### Deriving `username` for OAuth sign-ups
`users.username` is `NOT NULL`, unique, lower-cased, charset `[a-z0-9._-]`. Derive from the email local-part (sanitize; append a numeric suffix on collision), or prompt the user. It's the backend's choice, but it must satisfy those constraints.

## Session handoff (must match `lib/auth/session.ts` exactly)

1. `token` = 32 random bytes, base64url.
2. Insert `sessions`: `id = sha256(token)` (hex), `user_id`, `user_agent` (≤400 chars), `expires_at = now + 30 days` (`created_at`/`last_seen_at` default to now).
3. Set two cookies on the shared origin with attributes `{ secure: prod, sameSite: "lax", path: "/", expires: expires_at }`:
   - `session` — **httpOnly** — value = raw `token`.
   - `session_user` — **not** httpOnly — value = the user's `username` (display mirror; role is intentionally not included).
4. Redirect to `/{locale}/account` (or a safe `next`).

After this, Next's `validateSession` resolves the user with no further coordination. Sign-out, "log out everywhere", force-logout, and session revocation all work because they operate on the same `sessions` rows.

## Notes
- OAuth-only users have `password_hash = NULL`: they can't password-login (Next rejects it) and the account page hides "change password" (Phase C adds "set a password").
- Never store the raw session token or provider tokens in the DB. `accounts` holds only the provider `sub` + email.
- `unlinkAccount` (Next server action) refuses to remove a user's only sign-in method; the backend should apply the same rule if it offers unlinking.
