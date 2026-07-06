/**
 * Upload a saved quote's original screenshot to R2 via the backend's presigned
 * POST (docs/file-upload-contract.md, the **private** `quote-image` purpose).
 *
 * Mirrors the avatar flow, minus the public URL (quote images are private client
 * PII — served only through the ownership-checked GET /api/ai/quote-image/{key}):
 *   1. ask the backend to sign a presigned R2 POST,
 *   2. POST the bytes DIRECTLY to R2 (they never touch our servers),
 *   3. return the server-chosen object key to store on the saved_quotes row.
 *
 * Returns null on any failure so the caller can still save the quote as text-only
 * rather than losing it because an image upload hiccuped.
 */
export async function uploadQuoteImage(
  file: File,
  signUrl: string,
): Promise<{ key: string; mediaType: string } | null> {
  try {
    // 1. Presign (session cookie rides along on the same-origin fetch).
    const signRes = await fetch(`${signUrl}/sign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ purpose: "quote-image", contentType: file.type, size: file.size }),
    });
    if (!signRes.ok) return null;
    const { uploadUrl, fields, key } = await signRes.json();
    if (typeof key !== "string" || !uploadUrl) return null;

    // 2. Upload straight to R2 (the signed policy fields must precede the file).
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v as string);
    form.append("file", file);
    const up = await fetch(uploadUrl, { method: "POST", body: form });
    if (!up.ok) return null;

    return { key, mediaType: file.type };
  } catch {
    return null;
  }
}
