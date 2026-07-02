import "server-only";

/**
 * Server-side auth. This is the security boundary — every privileged Server
 * Action / Route Handler must check it, regardless of what the UI shows.
 *
 * TODO(auth): wire this to real login. Read the session cookie (e.g. the Strapi
 * users-permissions JWT), verify it, and resolve the user + their permissions
 * from their role. For now it returns null, so nothing is authorized.
 */
export type CurrentUser = {
  id: string;
  email: string;
  /** Flat permission strings resolved from the user's role, e.g. "news:revalidate". */
  permissions: string[];
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // TODO(auth): const token = (await cookies()).get("jwt")?.value; verify + map role.
  return null;
}

/** True when the signed-in user holds `permission`. */
export async function can(permission: string): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.permissions.includes(permission) ?? false;
}
