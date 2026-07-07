import { USER_COOKIE } from "./cookies";

/** The signed-in user's public identity — safe to expose to the client. */
export type PublicUser = { username: string; displayName?: string };

// Re-exported for locality: the client nav helpers below and the cookie's name are a
// unit. The role is deliberately NOT mirrored — no client code needs it, and access
// is decided server-side, so there's no reason to expose it.
export { USER_COOKIE };

/**
 * Cookie value for the nav mirror: `username|displayName`, or the bare username
 * when there is no display name (also the legacy format — old sessions and the
 * backend's OAuth handoff parse fine). Usernames can't contain `|` (registration
 * restricts the charset), so the FIRST `|` is an unambiguous separator even if a
 * display name contains one. The Python backend mirrors this in routers/auth.py.
 */
export function serializePublicUser(user: PublicUser): string {
  const name = user.displayName?.trim();
  return name ? `${user.username}|${name}` : user.username;
}

/** Raw value of the readable user cookie on the client ("" when absent or on the server). */
export function readUserCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${USER_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

/** Parse the cookie value (`username|displayName` or a bare username) into a user. */
export function parsePublicUser(raw: string): PublicUser | null {
  const value = raw.trim();
  if (!value) return null;
  const sep = value.indexOf("|");
  if (sep === -1) return { username: value };
  const username = value.slice(0, sep).trim();
  const displayName = value.slice(sep + 1).trim();
  if (!username) return null;
  return displayName ? { username, displayName } : { username };
}
