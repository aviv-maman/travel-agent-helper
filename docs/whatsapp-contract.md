# WhatsApp contract

Send messages (typically a generated **quote** from the [AI quote assistant](./ai-quote-assistant-contract.md), or an alert) to a client's WhatsApp. Backend-owned because it holds the provider credentials and is the integration surface. (Telegram is explicitly deferred.)

## Provider

A WhatsApp Business API provider — **Meta WhatsApp Cloud API** (free tier for service conversations) or an aggregator (Twilio, 360dialog). Credentials (phone-number id, access token) live **only on the backend**. Note: business-initiated messages outside the 24-hour service window must use **pre-approved templates** — plan a "quote" template.

## Endpoint

`POST {BACKEND_URL}/whatsapp/send` — authenticated (validate the `session` cookie; **admin-only** — the backend rejects any non-`admin` role, editors included; 2026-07 decision).
- Body: `{ to: "<E.164 phone>", body?: string, template?: { name, params[] } }`.
- Backend: call the provider; return `{ id }` or a non-2xx on failure. Rate-limit per sender.

## Flow with the AI feature

> **Status:** the Next side of this flow is **not built yet** — nothing in the app calls `/whatsapp/send`. Today's WhatsApp touchpoints (dashboard phone actions, quote sharing) are plain client-side `wa.me` deep-links that open the agent's own WhatsApp. The section below is the intended design for when the server-side send lands.

The natural pairing: user generates a quote in the chat → clicks "Send to client on WhatsApp" → Next server action (permission-checked) calls `/whatsapp/send` with the quote text (or a template + the quote as a parameter). Keep the quote text server-side; don't trust a client-supplied body beyond what the user just generated.

## Security / notes
- Provider token never leaves the backend.
- Validate/normalize `to` to E.164; log sends (audit) without the full message body if it contains client PII.
- Respect the 24-hour window + template rules to avoid delivery failures.
