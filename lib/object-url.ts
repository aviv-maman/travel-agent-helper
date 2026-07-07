/**
 * Stable object URL per File, cached for the page's lifetime instead of revoked.
 *
 * The create-in-useMemo / revoke-in-effect-cleanup pattern breaks under React
 * StrictMode's dev double-mount: the memoized URL survives the remount while the
 * first cleanup revokes it, leaving a broken <img>. And setState-in-effect (the
 * other classic fix) is banned by our lint rules. Caching sidesteps both: the URL
 * is derived data (same File → same URL), and the Files here are small session
 * screenshots already retained in chat state, so not revoking adds no meaningful
 * memory. The browser frees everything on page unload.
 */
const urls = new WeakMap<File, string>();

export function fileUrl(file: File): string {
  let url = urls.get(file);
  if (!url) {
    url = URL.createObjectURL(file);
    urls.set(file, url);
  }
  return url;
}
