# File upload contract (Cloudflare R2, presigned)

A **generic** upload service on the backend. First concrete use: **user avatars** (open to any signed-in user, for their own profile). Later: admin/editor-only uploads for new sections — images, and likely documents (`pdf`, `docx`, `xlsx`, …). The design is per-**purpose** so a new upload type is a config row, not a redesign.

Storage: **Cloudflare R2** (S3-compatible, 10 GB free, no egress fees). Uploads go **direct to R2 via a presigned URL** — the bytes never transit Vercel or the backend.

## Topology addendum (on top of [backend-overview.md](./backend-overview.md))

- **R2 credentials live only on the backend** (account id, access key/secret, bucket, and the public base URL). Next never sees them.
- **Next owns the schema.** Persisting a resulting URL is a Next server action writing a column the Next repo migrated. Avatar → add `users.avatarUrl` (nullable `text`). Future purposes add their own column/table in the Next repo first.
- **Env:** Next exposes `FILE_UPLOAD_URL` (base of the signing endpoint). Upload UI stays hidden until it's set (mirror the `AUTH_BACKEND_URL` pattern).

## Purpose policy (the extensible core)

The backend keeps a table of purposes; every request names one and is checked against it:

| purpose | who (permission) | allowed types | max size | bucket visibility |
|---|---|---|---|---|
| `avatar` | any signed-in user (writes their **own** `users.avatarUrl`) | `image/png`, `image/jpeg`, `image/webp` | 2 MB | **public** |
| `content-image` *(future)* | `content:edit` (editor + admin, **not agent**) | `image/*` allowlist | 8 MB | public |
| `document` *(future)* | `content:edit` | `application/pdf`, `docx`, `xlsx` mimes | 20 MB | **private** (signed GET on download) |

Permissions come from `ROLE_PERMISSIONS` in [`lib/auth/index.ts`](../lib/auth/index.ts) — agents hold none, so gating future uploads on `content:edit` correctly excludes them; avatars are the exception (any user, own row).

## Flow (presigned POST → direct to R2)

```
1. Client picks a file.
2. Client → backend  POST {FILE_UPLOAD_URL}/sign   (session cookie sent; same-origin)
        body: { purpose, contentType, size }
   backend: validate cookie → user+role; look up purpose policy; reject if
            permission/type/size fail; make a random key; return a presigned
            POST (url + fields) with the policy baked in.
        ← { uploadUrl, fields, key, publicUrl }
3. Client → R2  POST uploadUrl (multipart form: ...fields, file)   [direct upload]
4. Client → Next server action  persist({ purpose, key, publicUrl })
   Next: RE-CHECK permission; verify publicUrl starts with the configured R2
         public base AND key matches the purpose's prefix; then write the DB
         (e.g. users.avatarUrl for the current user).
```

**Why presigned POST (not PUT):** S3/R2 presigned **POST** supports a policy with `content-length-range` and a `Content-Type` condition, so **size and type are enforced by R2 at upload time**. Presigned PUT can't cap size, so you'd have to HEAD-and-delete oversize files after the fact.

## Endpoints

### `POST {FILE_UPLOAD_URL}/sign` — authenticated
- **Auth:** validate the Next `session` cookie exactly as `lib/auth/session.ts` does (hash → `sessions.id`, not expired, `mfaPending = false`) → user + role. Reject unauthenticated with `401`.
- **Body:** `{ purpose: string, contentType: string, size: number }`.
- **Checks:** purpose exists; user holds the purpose's permission; `contentType` in the allowlist; `size` ≤ max.
- **Key:** `${purpose}/${uuid4}.${ext}` — random, no user-controlled path (prevents overwrite/traversal).
- **Presign:** short expiry (~2 min), conditions = exact `Content-Type` + `content-length-range` [0, max].
- **Returns:** `{ uploadUrl, fields, key, publicUrl }` (public bucket) **or** `{ uploadUrl, fields, key }` (private bucket — no public URL; downloads use the signed-GET endpoint below).

### `GET {FILE_UPLOAD_URL}/signed-get?key=…` — authenticated *(only for private purposes)*
Returns a short-lived signed R2 GET URL after re-checking the caller may read that key. Public purposes (avatars) skip this — R2's public/CDN domain serves them directly.

## Security notes

- **Random keys + policy-enforced type/size** are the core defenses; never trust client-provided keys or URLs when persisting — validate against the R2 public base + purpose prefix.
- **Private by default for documents.** Only avatars/content-images are public. A private bucket + signed GET keeps uploaded documents from being world-readable.
- **No inline processing with presigned upload.** Because bytes go straight to R2, the backend can't strip EXIF or virus-scan inline. If a future purpose needs that, use a **proxied** upload for *that purpose* (client → backend multipart → backend scans/re-encodes → R2), at the cost of bytes transiting the backend. Avatars don't need it.
- **Optional shared secret:** an `X-Upload-Key` header Next includes and the backend checks, so only our app can request signatures.

## Avatar specifics (the first purpose to build)

- Schema: `users.avatarUrl text` (nullable), added in the Next repo.
- UI: `components/auth/user-avatar.tsx` renders `avatarUrl` when present, else the existing initials.
- Persist action: updates **only the current user's** row (no admin-sets-others needed for v1).
- Replacing an avatar orphans the old R2 object — fine short-term; add an R2 lifecycle rule or a cleanup pass later.

## Alternative worth knowing (no backend needed for the simple case)

Generating an R2 presigned URL is just an S3 signature — a **Next server action can do it directly** (R2 creds in Vercel env), with no Python backend involved. That's a lighter path if avatars are all you need soon. We're routing it through the backend because (a) it centralizes R2 creds and future document processing (AV scan, private downloads) in one place, matching the architecture, and (b) it keeps Vercel free of storage secrets. If the backend slips, avatars could ship via a server action first and migrate later.
