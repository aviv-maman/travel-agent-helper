# Password reset, email verification & registration email

These flows are **owned by Next server actions** (tokens, DB, sessions) — the backend only **sends the email** ([email-contract.md](./email-contract.md)). Documented here because they're a coherent unit and define the schema/token rules the backend's templates assume.

## Schema additions (made in the Next repo — Next owns migrations)

- `users.email` **already exists** (nullable, unique). Keep nullable (OAuth/legacy users), but **require it at registration** at the app level.
- `users.emailVerifiedAt timestamptz null` — set when the user confirms their address.
- `email_tokens` table (covers both verification and reset):
  - `id` (hash of the raw token — store only the hash, like sessions), `userId`, `kind` (`verify` | `reset`), `expiresAt`, `usedAt`, `createdAt`.
  - Index on `userId`. A raw token is random 32 bytes (base64url); the row id is `sha256(rawToken)`.

## Registration change

Capture **email** at registration (required), lower-cased, unique. Create the user with `emailVerifiedAt = null`, then trigger the verification flow. Existing email-less users add/verify their address from **profile**.

## Email verification

1. Server action creates a `verify` token (store hash, ~24 h expiry), calls `/email/send` (`email_verification`, with the confirm URL).
2. Confirm route/action: look up `sha256(token)`, ensure `kind=verify`, not expired, not used → set `users.emailVerifiedAt = now`, mark token used.
3. Gate email-dependent actions (password reset, notifications) on a **verified** address.

## Forgot / reset password (best-practice checklist — as agreed)

1. **Request (forgot):** user submits an email. **Neutral response** always — "if that address exists, we've sent a link" — never reveal whether an account exists.
2. **Rate-limit** requests per IP (+ per email) reusing the pattern in [`lib/auth/rate-limit.ts`](../lib/auth/rate-limit.ts).
3. If a **verified** user exists: create a `reset` token — **random, store only its hash**, **single-use**, **short expiry (30–60 min)** — and `/email/send` (`password_reset`, with the reset URL).
4. **Reset:** validate `sha256(token)` (`kind=reset`, not expired, not used). Then:
   - If the user has **TOTP enabled, still require a valid 2FA code** (or a backup code) to proceed — email possession alone must not bypass the second factor.
   - Set the new `passwordHash` (scrypt, as today) → **mark the token used** → **invalidate ALL sessions** (`invalidateUserSessions`) → **audit** (`recordAudit("password.reset")`).
5. **Invalidate outstanding reset tokens** for that user on success and whenever the password changes.

## Related email-driven items (same email transport)

- **Security notifications:** on new-device sign-in, password change, and 2FA disable, send a `security_alert`. Triggered by the existing auth server actions.
- **Admin send-reset:** an admin action (gated `users:manage`) that issues a reset token for another user and emails them — reuses the reset flow, audited.
- **Emailed invites:** when creating an invite ([`createInvite`](../lib/auth/actions.ts)), optionally email the invite link (`invite` template) in addition to showing the code.

## Out of scope here
- Magic-link login (dropped). Passwordless is covered later by **Passkeys/WebAuthn**, not email links.
