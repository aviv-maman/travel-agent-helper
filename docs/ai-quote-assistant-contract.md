# AI quote assistant contract

A per-user feature: a user pastes their **own** AI API key; that unlocks a **chat** page where they prompt Claude and upload an image (a hotel offer, a screenshot). Server-side "skills" instruct Claude to **extract the hotel details** (name, dates, price, board, conditions…) and produce a **client-ready quote** — the total price of the vacation as forwardable text. The same chat is general-purpose (tweak the quote, ask follow-ups).

It's two deliverables: **(A)** an AI-credentials store, **(B)** the quote chat. (A) gates (B). Both live on the backend (it holds the encryption key and does the streaming/vision calls).

## Access

Any signed-in user may add a key and use the chat (agents included — this is their tool). The feature is simply **hidden until the user has a stored key**.

## Provider-agnostic, Anthropic first

Model the store around a `provider` enum (`anthropic`, room for `openai`, …). Implement **Anthropic** first. Default model: **`claude-opus-4-8`** (strong vision + structured outputs). Since it's the **user's** key, **all token cost is on them** — no billing burden on us, and their key carries their own rate limits.

---

## A. AI-credentials store

### Schema (added in the Next repo — Next owns migrations)

`user_ai_credentials`:
- `id`, `userId` (FK, cascade), `provider` (enum), `ciphertext` (bytea/text), `nonce`, `last4` (varchar(4) — for display), `createdAt`, `updatedAt`.
- Unique `(userId, provider)`.

### Encryption — the critical part

- **Encrypt the key at rest** with AES-256-GCM (or libsodium `crypto_secretbox`). The **encryption key lives in the backend's secret store**, *never* in the DB. Store `ciphertext` + `nonce` + `last4` only.
- **Never return the plaintext** to any client after entry — surface only `…{last4}`.
- **Validate on save** with one cheap call using the submitted key (e.g. `client.models.list()` or a 1-token `messages.create`); reject on `401`.
- Allow **rotate** and **delete**; delete on account deletion (FK cascade handles the row; nothing else stored).

### Endpoints (authenticated — validate the `session` cookie as the DAL does)

- `POST {BACKEND_URL}/ai/credentials` — body `{ provider, apiKey }` → validate → encrypt → upsert → return `{ provider, last4 }`. Never echo the key.
- `DELETE {BACKEND_URL}/ai/credentials/{provider}` → remove.
- `GET {BACKEND_URL}/ai/credentials` → `[{ provider, last4 }]` (metadata only) — drives the "AI is configured" UI state.

---

## B. Quote chat

A Next page (hidden unless a key exists) posts a prompt + optional image(s) to the backend, which decrypts the user's key, calls Claude with the extraction skill, and **streams** the reply back.

### Endpoint

`POST {BACKEND_URL}/ai/chat` (authenticated, **SSE/streaming**)
- Body: `{ messages: [...], image?: <upload | base64> }` (send prior turns for multi-turn; the API is stateless).
- Backend: load + decrypt the caller's key → build the Anthropic request → **stream** tokens back to the browser.

### How the backend calls Claude (Python SDK, grounded in the claude-api skill)

- **Client per request with the user's key:** `from anthropic import Anthropic; client = Anthropic(api_key=decrypted_user_key)`.
- **Vision:** put the image as a content block *before* the text — `{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": <b64>}}`. (Images go **inline to Claude; do not persist** hotel images by default — privacy. Optionally store *text* transcripts for history.)
- **Streaming** (avoids HTTP timeouts, live UX):
  ```python
  with client.messages.stream(
      model="claude-opus-4-8",
      max_tokens=16000,
      system=QUOTE_SKILL_SYSTEM,     # the "skill" — extraction rules + quote format
      messages=messages,
  ) as stream:
      for text in stream.text_stream:
          yield text                  # forward over SSE to the browser
  ```
- **Reliable extraction → use structured outputs**, then render the quote from the fields (far more robust than parsing free text). Do a first structured pass, then format:
  ```python
  extraction = client.messages.parse(
      model="claude-opus-4-8", max_tokens=4000,
      output_config={"format": {"type": "json_schema", "schema": HOTEL_QUOTE_SCHEMA}},
      messages=[{"role": "user", "content": [image_block, {"type": "text", "text": prompt}]}],
  )
  # extraction.parsed_output → {hotel, city, checkIn, checkOut, nights, board, pricePerNight, total, currency, conditions[]}
  ```
  `HOTEL_QUOTE_SCHEMA` note: structured outputs disallow numeric/string constraints (`minimum`, `maxLength`, …) and require `additionalProperties: false` on every object — keep the schema plain.
- **Model default `claude-opus-4-8`.** Adaptive thinking (`thinking: {"type": "adaptive"}`) is optional for harder reasoning; not required for extraction.

### The "skill" (server-side)

A bilingual (he/en) **system prompt** that: states the goal (extract hotel offer → produce a client quote), defines the output quote template (hotel, dates, nights, board, price breakdown, **total**, key conditions, a forwardable closing line), and tells Claude to ask for missing essentials rather than invent them. Keep it in the backend, versioned. General prompts (edits, follow-ups) flow through the same chat unchanged.

### Error handling (map Anthropic errors to clean UX)

- `401` from Anthropic → "your API key is invalid" (prompt re-entry; consider auto-clearing the stored key).
- `429` → "you've hit your provider's rate limit — try again shortly."
- `stop_reason == "refusal"` → surface a neutral message; don't retry the same input.
- Never log the decrypted key or full image bytes.

---

## Security summary

- User keys **encrypted at rest**, decryption key only on the backend, plaintext never returned.
- Every endpoint validates the Next `session` cookie (same mechanism as OAuth/[backend-overview.md](./backend-overview.md)).
- Cost and rate limits ride on the **user's** key.
- Images are sent to Claude inline and **not stored** by default.

## Schema additions checklist (Next repo)
- `user_ai_credentials` table (above).
- *(optional, only if you want chat history)* `ai_chats` / `ai_messages` (store **text** transcripts; do not store images).
