/**
 * Upload a saved quote's original screenshot to Supabase Storage via the backend's
 * presigned PUT (docs/file-upload-contract.md, the **private** `quote-image` purpose).
 *
 * Mirrors the avatar flow, minus the public URL (quote images are private client
 * PII — served only through the ownership-checked GET /api/ai/quote-image/{key}):
 *   1. ask the backend to sign a presigned storage PUT,
 *   2. PUT the bytes DIRECTLY to storage (they never touch our servers),
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
    const { uploadUrl, contentType, key } = await signRes.json();
    if (typeof key !== "string" || !uploadUrl) return null;

    // 2. Upload straight to Supabase Storage (raw PUT; Content-Type must match the
    // type signed into the URL, else the signature check rejects it).
    const up = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": contentType ?? file.type },
      body: file,
    });
    if (!up.ok) return null;

    return { key, mediaType: file.type };
  } catch {
    return null;
  }
}
