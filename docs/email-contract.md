# Transactional email contract

A thin backend capability: **send a templated transactional email**. All the *logic* that decides to send (reset tokens, verification state, notifications) stays in Next server actions; the backend is just the transport that holds the provider secret.

## Provider

Use a transactional provider — **Resend** (3k emails/mo free) or SMTP. Requirements: a **verified sending domain** with **SPF + DKIM** (and ideally DMARC) so mail lands in inboxes. The provider API key lives **only on the backend**.

## Endpoint

### `POST {BACKEND_URL}/email/send` — service-authenticated
- **Auth:** this is called **server-to-server from Next server actions**, not from the browser. Protect it with a shared secret header (`X-Service-Key`) that Next holds in its env; reject otherwise. (It does *not* use the user session cookie.)
- **Body:**
  ```json
  { "to": "user@example.com", "template": "password_reset", "locale": "he", "data": { "url": "https://…", "expiresMinutes": 60 } }
  ```
- **Templates** live on the backend (bilingual he/en, keyed by `template` + `locale`). Start with: `email_verification`, `password_reset`, `security_alert`, `invite`.
- **Behavior:** render template + `data`, send via the provider, return `{ "id": "<provider-id>" }` on success, non-2xx on failure. Next treats failure as "couldn't send" and surfaces a soft error (it must **not** leak whether the address exists — see [password-reset-contract.md](./password-reset-contract.md)).
- **Idempotency (optional):** accept an `Idempotency-Key` so a retried server action doesn't double-send.

## Why backend-owned (your choice)

Centralizes the provider secret and templates in one place, consistent with the architecture. The alternative (calling Resend directly from a Next server action) is simpler but puts the key in Vercel — we chose backend-owned.

## Security / best practice
- Never log full recipient lists or rendered bodies with tokens in them.
- Rate-limit per-recipient on the backend as a backstop (Next also rate-limits the triggering actions).
- Treat `data.url` as opaque; the backend never generates auth tokens — Next does.
