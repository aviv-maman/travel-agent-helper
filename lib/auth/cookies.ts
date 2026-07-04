/**
 * Names of the auth cookies, in one place so the server session store (session.ts)
 * and the Edge middleware (proxy.ts) that set / read / clear them can't drift out of
 * sync. Plain string constants with no imports — safe to pull into the Edge runtime.
 */

/** httpOnly opaque session token. The real credential; validated against the DB. */
export const SESSION_COOKIE = "session";

/**
 * Non-httpOnly mirror of the public identity (just the username), so the client nav
 * can show who's signed in without the layout reading the session server-side (which
 * would make every page dynamic). Display-only — the httpOnly session cookie + the
 * server DAL are the real security boundary.
 */
export const USER_COOKIE = "session_user";

/**
 * Presence-only marker the middleware sets for a short TTL after validating the
 * session against the DB, letting the next navigations skip the lookup. Carries no
 * data and grants no access (see proxy.ts).
 */
export const SESSION_VERIFIED_COOKIE = "session_verified";
