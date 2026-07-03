/** The signed-in user's public identity — safe to expose to the client. */
export type PublicUser = { username: string };

/**
 * A **non-httpOnly** cookie mirroring the public identity (just the username), so
 * the client nav can show who's signed in *without* the layout reading the
 * session server-side (which would make every page dynamic). Display-only: the
 * httpOnly session cookie + `can()` are the real security boundary. The role is
 * deliberately NOT mirrored — no client code needs it, and access is decided
 * server-side, so there's no reason to expose it.
 */
export const USER_COOKIE = "session_user";

/** Raw value of the readable user cookie on the client ("" when absent or on the server). */
export function readUserCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)session_user=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/** Parse the cookie value (the username) into a user, or null when absent. */
export function parsePublicUser(raw: string): PublicUser | null {
  const username = raw.trim();
  return username ? { username } : null;
}
