# File upload contract (Supabase Storage, presigned PUT)

A **generic** upload service on the backend. First concrete use: **user avatars** (open to any signed-in user, for their own profile). Later: admin/editor-only uploads for new sections — images, and likely documents (`pdf`, `docx`, `xlsx`, …). The design is per-**purpose** so a new upload type is a config row, not a redesign.

Storage: **Supabase Storage** (S3-compatible, free tier, no credit card required). Uploads go **direct to storage via a presigned PUT** — the bytes never transit Vercel or the backend. (We started on Cloudflare R2 but R2 requires a card on file; Supabase's S3 endpoint is the no-card equivalent. The only behavioural difference: Supabase's S3 endpoint has **no POST-policy form upload**, so we sign a **PUT** and move the type/size limits to per-bucket settings — see the flow + "Why presigned PUT" below.)

**Two buckets.** Supabase buckets are public-or-private at the *bucket* level (unlike R2's one-bucket-plus-prefixes). So:
- a **public** bucket (`avatars`) — objects served directly at its public URL, and
- a **private** bucket (`quote-images`) — client PII, reachable only via a signed GET.

Each bucket sets its **Allowed MIME types** + **max file size** in the Supabase dashboard; that is where type/size are enforced at upload time. Match them to the purpose policy below (avatars: images, 2 MB; quote-images: images incl. gif, 8 MB).

## Topology addendum (on top of [backend-overview.md](./backend-overview.md))

- **Storage credentials live only on the backend** (S3 endpoint, region, access key/secret, the two bucket names, and the public base URL). Next never sees them.
- **Next owns the schema.** Persisting a resulting URL is a Next server action writing a column the Next repo migrated. Avatar → add `users.avatarUrl` (nullable `text`). Future purposes add their own column/table in the Next repo first.
- **Env:** Next exposes `FILE_UPLOAD_URL` (base of the signing endpoint) and `SUPABASE_PUBLIC_BASE_URL` (must equal the backend's, to validate persisted avatar URLs). Upload UI stays hidden until `FILE_UPLOAD_URL` is set (mirror the `AUTH_BACKEND_URL` pattern).

## Purpose policy (the extensible core)

The backend keeps a table of purposes; every request names one and is checked against it:

| purpose | who (permission) | allowed types | max size | bucket visibility |
|---|---|---|---|---|
| `avatar` | any signed-in user (writes their **own** `users.avatarUrl`) | `image/png`, `image/jpeg`, `image/webp` | 2 MB | **public** |
| `quote-image` | any signed-in user (stored on their **own** `saved_quotes` row) | `image/png`, `image/jpeg`, `image/webp`, `image/gif` (the set `/ai/chat` accepts) | 8 MB | **private** (client PII) |
| `content-image` *(future)* | `content:edit` (editor + admin, **not agent**) | `image/*` allowlist | 8 MB | public |
| `document` *(future)* | `content:edit` | `application/pdf`, `docx`, `xlsx` mimes | 20 MB | **private** (signed GET on download) |

Permissions come from `ROLE_PERMISSIONS` in [`lib/auth/index.ts`](../lib/auth/index.ts) — agents hold none, so gating future uploads on `content:edit` correctly excludes them; avatars are the exception (any user, own row).

## Flow (presigned PUT → direct to storage)

```
1. Client picks a file.
2. Client → backend  POST {FILE_UPLOAD_URL}/sign   (session cookie sent; same-origin)
        body: { purpose, contentType, size }
   backend: validate cookie → user+role; look up purpose policy; reject if
            permission/type/size fail; make a random key; sign a PUT to the
            purpose's bucket (public or private) with the Content-Type baked in.
        ← { uploadUrl, key, contentType, publicUrl? }
3. Client → storage  PUT uploadUrl   (raw file bytes; header Content-Type: contentType)
   The signed Content-Type must match, and the bucket's dashboard MIME/size
   limits reject anything outside the policy.                    [direct upload]
4. Client → Next server action  persist({ purpose, key, publicUrl })
   Next: RE-CHECK permission; verify publicUrl starts with the configured storage
         public base AND key matches the purpose's prefix; then write the DB
         (e.g. users.avatarUrl for the current user).
```

**Why presigned PUT (not POST):** the original R2 design used a presigned **POST** whose policy carried a `content-length-range` + `Content-Type` condition, enforced at upload time. **Supabase's S3 endpoint doesn't implement POST-object form uploads**, so we sign a **PUT** instead: the exact `Content-Type` is signed into the URL (the client can't smuggle a different type), and **size + MIME are enforced by the bucket's own limits** set in the Supabase dashboard. The backend still pre-checks type/size before signing. Net security is equivalent; the enforcement point moves from a per-request policy to per-bucket config.

## Endpoints

### `POST {FILE_UPLOAD_URL}/sign` — authenticated
- **Auth:** validate the Next `session` cookie exactly as `lib/auth/session.ts` does (hash → `sessions.id`, not expired, `mfaPending = false`) → user + role. Reject unauthenticated with `401`.
- **Body:** `{ purpose: string, contentType: string, size: number }`.
- **Checks:** purpose exists; user holds the purpose's permission; `contentType` in the allowlist; `size` ≤ max.
- **Key:** `${purpose}/${uuid4}.${ext}` — random, no user-controlled path (prevents overwrite/traversal). **Exception — `avatar`:** the key is the deterministic `avatar/${userId}.${ext}` so each user has exactly ONE avatar object that uploads overwrite in place; the sign call also best-effort deletes stale variants under other extensions, and `publicUrl` carries a `?v=<hex>` cache-buster (the bare URL is stable across replacements).
- **Bucket:** public purposes → the public bucket; private → the private bucket.
- **Presign:** short expiry (~2 min), a PUT with the exact `Content-Type` signed in.
- **Returns:** `{ uploadUrl, key, contentType, publicUrl }` (public bucket) **or** `{ uploadUrl, key, contentType }` (private bucket — no public URL; downloads use the signed-GET endpoint below).

### `GET {FILE_UPLOAD_URL}/signed-get?key=…` — authenticated *(only for private purposes)*
Returns a short-lived signed storage GET URL after re-checking the caller may read that key. Public purposes (avatars) skip this — the public bucket's URL serves them directly.

**As implemented for `quote-image`:** the signed GET lives at **`GET /ai/quote-image/{key}`** (routers/ai.py), not a generic `/signed-get` — it 302-redirects to a 5-minute signed storage GET only if the caller owns a `saved_quotes` row referencing `key`, and 404s on any miss (never reveals which keys exist).

### `POST {FILE_UPLOAD_URL}/delete-quote-images` — service-key only
- **Auth:** `X-Service-Key` only (Next server action → backend, server-to-server). Not session-callable.
- **Body:** `{ keys: string[] }` — the `image_key`s of `saved_quotes` rows Next **already deleted**.
- **Guards:** each key must start with `quote/` (can't be repurposed against avatars), and is re-checked against the DB — a key still referenced by ANY surviving quote is **withheld**, not deleted (two quotes saved from one conversation share a screenshot: the client reuses the eagerly-uploaded key).
- **Returns:** `{ deleted, withheld }`. Best-effort: storage unconfigured → `deleted: 0` (the DB rows are already gone; the weekly sweep is the backstop).

## Quote-image delete lifecycle

1. **User deletes a saved quote** → the Next server action deletes the `saved_quotes` row first (source of truth), then calls `POST /files/delete-quote-images` with the freed key(s). Re-saving a quote from the same conversation after a delete is allowed — the eagerly-uploaded key is still valid until nothing references it.
2. **Weekly backstop:** `POST /cron/quotes` deletes rows older than `QUOTE_RETENTION_DAYS` (default 14) and frees their now-unreferenced screenshots — the same shared-key withholding applies (`db.delete_old_saved_quotes` only returns keys no surviving row references).

## Security notes

- **Random keys + signed Content-Type + per-bucket MIME/size limits** are the core defenses; never trust client-provided keys or URLs when persisting — validate against the storage public base + purpose prefix.
- **Private by default for PII/documents.** Avatars/content-images live in the public bucket; quote images and documents live in the **private** bucket, reachable only via signed GET — so they're never world-readable, even by guessing a key (the R2 single-bucket design couldn't guarantee this).
- **No inline processing with presigned upload.** Because bytes go straight to storage, the backend can't strip EXIF or virus-scan inline. If a future purpose needs that, use a **proxied** upload for *that purpose* (client → backend multipart → backend scans/re-encodes → storage), at the cost of bytes transiting the backend. Avatars don't need it.
- **Optional shared secret:** an `X-Upload-Key` header Next includes and the backend checks, so only our app can request signatures.

## Avatar specifics (the first purpose to build)

- Schema: `users.avatarUrl text` (nullable), added in the Next repo.
- UI: `components/auth/user-avatar.tsx` renders `avatarUrl` when present, else the existing initials.
- Persist action: updates **only the current user's** row (no admin-sets-others needed for v1).
- Replacing an avatar does NOT orphan the old object: the key is the deterministic `avatar/${userId}.${ext}`, so uploads overwrite in place (stale other-extension variants are best-effort deleted at sign time).

## Alternative worth knowing (no backend needed for the simple case)

Generating a presigned URL is just an S3 signature — a **Next server action can do it directly** (storage creds in Vercel env), with no Python backend involved. That's a lighter path if avatars are all you need soon. We're routing it through the backend because (a) it centralizes storage creds and future document processing (AV scan, private downloads) in one place, matching the architecture, and (b) it keeps Vercel free of storage secrets. If the backend slips, avatars could ship via a server action first and migrate later.
