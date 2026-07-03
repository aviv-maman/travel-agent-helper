import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User, UserRole } from "@/db/schema";
import { validateSession } from "./session";

/**
 * Auth data-access layer. `getCurrentUser` is the single read path for "who is
 * signed in"; `can` / `requirePermission` are the security boundary every
 * privileged Server Action and gated page must check (the UI may hide things,
 * but the server decides).
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
 * Role → permission map. Access model:
 *   - Browsing content (hotels, suppliers, transfers, airlines, cancellations,
 *     news) is PUBLIC — no login needed — so those pages stay static/cacheable.
 *   - `agent`  = the authenticated baseline: an invited user who can sign in but
 *     holds no privileged permissions yet (same content view as an anonymous
 *     visitor; the floor of the hierarchy and the home for future agent-only
 *     features).
 *   - `editor` = agent + content operations (refresh the news feed; edit content).
 *   - `admin`  = everything, including user and invite management.
 * Features gate on these strings rather than on the role directly, so granting a
 * capability is a one-line change here.
 */
export const ROLE_PERMISSIONS = {
  admin: ["users:manage", "invites:manage", "news:revalidate", "content:edit"],
  editor: ["news:revalidate", "content:edit"],
  agent: [],
} as const satisfies Record<UserRole, readonly string[]>;

export type Permission = (typeof ROLE_PERMISSIONS)[UserRole][number];

function holds(role: UserRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission);
}

/** Whether the signed-in user holds `permission`. The real security check. */
export async function can(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  return user ? holds(user.role, permission) : false;
}

/** Return the signed-in user or redirect to login. For pages that require any login. */
export async function requireUser(locale: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return user;
}

/** Return the signed-in user if they hold `permission`, else redirect to login. */
export async function requirePermission(permission: Permission, locale: string): Promise<User> {
  const user = await requireUser(locale);
  if (!holds(user.role, permission)) redirect(`/${locale}/login`);
  return user;
}
