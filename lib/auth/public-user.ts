import type { UserRole } from "@/db/schema";

/** The signed-in user's public identity — safe to expose to the client. */
export type PublicUser = { username: string; role: UserRole };

/**
 * A **non-httpOnly** cookie mirroring the public identity, so the client nav can
 * show who's signed in *without* the layout reading the session server-side
 * (which would make every page dynamic). It is display-only: the httpOnly
 * session cookie + `can()` remain the real security boundary. Value format is
 * "username:role" (both use a safe charset, so no encoding needed).
 */
export const USER_COOKIE = "session_user";

const ROLES: readonly UserRole[] = ["admin", "editor", "agent"];

/** Raw value of the readable user cookie on the client ("" when absent or on the server). */
export function readUserCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)session_user=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/** Parse a "username:role" cookie value into a user, or null when absent/invalid. */
export function parsePublicUser(raw: string): PublicUser | null {
  const [username, role] = raw.split(":");
  if (!username || !ROLES.includes(role as UserRole)) return null;
  return { username, role: role as UserRole };
}
