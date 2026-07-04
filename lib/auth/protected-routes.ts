/**
 * Central list of auth-gated route prefixes + helpers shared by the middleware
 * (proxy.ts) and the login/MFA actions.
 *
 * Protection model (defense in depth):
 *   - proxy.ts middleware = OPTIMISTIC gate. Redirects protected *pages* to /login
 *     when the `session` cookie is absent. Fast, centralized, runs before render.
 *     It only sees the cookie's presence, never its validity — so it is NOT the
 *     security boundary.
 *   - Server DAL (`requireUser` / `requirePermission` / `getCurrentUser` / `can` in
 *     lib/auth) = the REAL boundary. Every protected layout, page and privileged
 *     Server Action must still check it (DB-backed session validation).
 *   - Client `useSession()` = cosmetic only (show/hide UI); never trusted.
 *
 * Gating an element inside a PUBLIC page: branch on `await getCurrentUser()` /
 * `await can(perm)` in a server component (render conditionally — do NOT redirect,
 * the page itself is public), use `useSession()` for client show/hide, and always
 * guard the underlying action/data with the DAL.
 *
 * No "server-only" here: this module is imported by proxy.ts (Edge middleware) and
 * holds only pure helpers + constants — no secrets, no DB.
 */

/** Locale-stripped path prefixes that require a signed-in user. Add new ones here. */
export const PROTECTED_PREFIXES = ["/account"] as const;

/** Whether `path` (locale already stripped, e.g. "/account/security") is gated. */
export function isProtectedPath(path: string): boolean {
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Sanitize a post-login `next` target. Accepts only an internal path under the
 * active locale (e.g. "/en/account/security"); anything else — an external URL, a
 * protocol-relative "//host", or a blank/missing value — falls back to the default
 * landing. Guards against open redirects.
 */
export function safeNext(next: string | null | undefined, locale: string): string {
  const fallback = `/${locale}/suppliers`;
  if (!next || !next.startsWith(`/${locale}/`) || next.startsWith("//")) return fallback;
  return next;
}
