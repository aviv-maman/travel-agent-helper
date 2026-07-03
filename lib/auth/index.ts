import "server-only";
import { cache } from "react";
import type { User, UserRole } from "@/db/schema";
import { validateSession } from "./session";

/**
 * Auth data-access layer. `getCurrentUser` is the single read path for "who is
 * signed in"; `can` is the security boundary every privileged Server Action must
 * check (the UI may hide things, but the server decides).
 */

/**
 * The current user, memoized per request with React `cache` — call it freely in
 * layouts, pages and actions without re-hitting the DB. Reading the cookie makes
 * any page that calls this dynamic, which is expected for auth-aware pages.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  return validateSession();
});

/**
 * Permissions granted by each role. Features gate on these strings rather than
 * on the role directly, so adding a capability is a one-line change here.
 */
export const ROLE_PERMISSIONS = {
  admin: ["users:manage", "invites:manage", "news:revalidate", "content:edit"],
  editor: ["news:revalidate", "content:edit"],
  agent: [],
} as const satisfies Record<UserRole, readonly string[]>;

export type Permission = (typeof ROLE_PERMISSIONS)[UserRole][number];

/** Whether the signed-in user holds `permission`. The real security check. */
export async function can(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return (ROLE_PERMISSIONS[user.role] as readonly string[]).includes(permission);
}
