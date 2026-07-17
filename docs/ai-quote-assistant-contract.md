# AI quote assistant contract

A per-user feature: a user pastes their **own** AI API key; that unlocks a **chat** page where they prompt Claude and upload an image (a hotel offer, a screenshot). Server-side "skills" instruct Claude to **extract the hotel details** (name, dates, price, board, conditions…) and produce a **client-ready quote** — the total price of the vacation as forwardable text. The same chat is general-purpose (tweak the quote, ask follow-ups).

It's two deliverables: **(A)** an AI-credentials store, **(B)** the quote chat. (A) gates (B). Both live on the backend (it holds the encryption key and does the streaming/vision calls).

## Access

Any signed-in user may add a key and use the chat (agents included — this is their tool). The feature is simply **hidden until the user has a stored key**.

### No-backend dev fallback (Next-side)

When `BACKEND_URL` is unset the frontend fully mocks the feature so it can be developed/demoed standalone: saving a key sets the `AI_MOCK_KEY_COOKIE` to fake the "configured" state (`app/actions/ai.ts`, `lib/ai/credentials.ts`), `NEXT_PUBLIC_AI_MOCK="1"` streams a canned quote (`lib/ai/stream.ts`), and saved quotes carry a `"mock"` sentinel `imageKey` resolved to a bundled sample image.

## Provider-agnostic, Anthropic first

Model the store around a `provider` enum (`anthropic`, room for `openai`, …). Implement **Anthropic** first. Default model: **`claude-sonnet-5`**, overridable without a code change via the backend `ANTHROPIC_MODEL` env (`quote.py`). Since it's the **user's** key, **all token cost is on them** — no billing burden on us, and their key carries their own rate limits.

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
      model=MODEL,                   # ANTHROPIC_MODEL env, default "claude-sonnet-5"
      max_tokens=16000,
      system=QUOTE_SKILL_SYSTEM,     # the "skill" — extraction rules + quote format
      tools=flight_tools.TOOLS,      # pricing/reference tools (commissions, IATA, FX)
      thinking={"type": "disabled"},
      messages=messages,
  ) as stream:
      for text in stream.text_stream:
          yield text                  # forward over SSE to the browser
  ```
- **Pricing runs as an agentic tool-use loop**, not a separate extraction pass: the stream call passes the pricing/reference tools and Claude calls them mid-conversation (surfaced to the browser as `tool` SSE events alongside `delta`/`error`/`done`). The quote is rendered from the model's final text. *(The original design here prescribed a two-pass `messages.parse` structured-outputs extraction; the implementation superseded it — there is no `HOTEL_QUOTE_SCHEMA`.)*

### The "skill" (server-side)

A bilingual (he/en) **system prompt** that: states the goal (extract hotel offer → produce a client quote), defines the output quote template (hotel, dates, nights, board, price breakdown, **total**, key conditions, a forwardable closing line), and tells Claude to ask for missing essentials rather than invent them. Keep it in the backend, versioned. General prompts (edits, follow-ups) flow through the same chat unchanged.

### Reference data (supplier commissions + IATA codes)

The pricing tools read two reference datasets (backend `sheets.py`):

- **Supplier commissions/baggage** — **DB-first** from the shared `quote_suppliers` table (Next migration 0025), which the agent edits in the app at **Settings → AI Commissions** (`/account/quote-commissions`, `content:edit`). The agent's legacy published Google-Sheet CSV (`SHEET_SUPPLIERS_CSV_URL`) remains the fallback while the table is empty or the DB is unreachable. Values are stored bare (percent numbers, baggage cells in the sheet grammar `כלול`/`130$`); a supplier may span several rows (per-destination terms) told apart by the notes.
- **IATA → airline name** — still the published sheet CSV (`SHEET_IATA_CSV_URL`), with `airlines_fallback.py` and then model knowledge (marked "unverified") behind it.

Both are cached in-process for ~10 minutes, so app/sheet edits reach the assistant without a redeploy.

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
