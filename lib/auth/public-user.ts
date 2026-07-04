import { USER_COOKIE } from "./cookies";

/** The signed-in user's public identity — safe to expose to the client. */
export type PublicUser = { username: string };

// Re-exported for locality: the client nav helpers below and the cookie's name are a
// unit. The role is deliberately NOT mirrored — no client code needs it, and access
// is decided server-side, so there's no reason to expose it.
export { USER_COOKIE };

/** Raw value of the readable user cookie on the client ("" when absent or on the server). */
export function readUserCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${USER_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

/** Parse the cookie value (the username) into a user, or null when absent. */
export function parsePublicUser(raw: string): PublicUser | null {
  const username = raw.trim();
  return username ? { username } : null;
}
