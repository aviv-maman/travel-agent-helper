"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, count, eq, gt, isNull, or } from "drizzle-orm";
import { THEME_COOKIE, THEME_MAX_AGE, isTheme } from "@/lib/theme";
import { db } from "@/db";
import {
  accounts,
  invitations,
  sessions,
  users,
  type UserRole,
  type AuthProviderName,
} from "@/db/schema";
import { hashPassword, verifyPassword } from "./password";
import {
  createSession,
  invalidateSession,
  invalidateOtherSessions,
  invalidateUserSessions,
  deleteAllUserSessions,
  currentSessionId,
} from "./session";
import { can, getCurrentUser } from ".";
import { recordAudit } from "./audit";
import { generateInviteCode, inviteStatus } from "./invites";
import { isLocked, recordFailure, clearAttempts, clientIp } from "./rate-limit";

export type AuthState = { error?: string; ok?: boolean };

/**
 * A well-formed but unmatchable hash. When the username doesn't exist we still
 * run a verify against this so the response takes the same time as a wrong
 * password — otherwise the timing difference would reveal which usernames exist.
 */
const DUMMY_HASH = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;

/** `locale` is bound by the form so the redirect stays on the active language. */
export async function login(
  locale: string,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "missing" };
  }
  const ip = await clientIp();
  if (await isLocked(ip)) {
    return { error: "locked" };
  }

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    await recordFailure(ip);
    return { error: "invalid" };
  }

  await clearAttempts(ip);
  await createSession(user);
  await recordAudit("login", { actorId: user.id });
  // Cross-device theme: apply this account's saved preference on this device.
  if (user.themePref && isTheme(user.themePref)) {
    (await cookies()).set(THEME_COOKIE, user.themePref, {
      path: "/",
      maxAge: THEME_MAX_AGE,
      sameSite: "lax",
    });
  }
  redirect(`/${locale}`);
}

export async function logout(locale: string): Promise<void> {
  await invalidateSession();
  redirect(`/${locale}`);
}

/** Self-service password change. Verifies the current password, then signs out other devices. */
export async function changePassword(
  locale: string,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < 8) return { error: "passwordShort" };
  if (next !== confirm) return { error: "passwordMismatch" };
  // Null hash = OAuth-only user with no password to verify (they'd use "set password").
  if (!user.passwordHash || !(await verifyPassword(current, user.passwordHash))) {
    return { error: "wrongPassword" };
  }

  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  await invalidateOtherSessions(user.id); // other devices must re-login with the new password
  await recordAudit("password.change", { actorId: user.id });
  return { ok: true };
}

/** Sign out of every device (including this one) and return to login. */
export async function logoutEverywhere(locale: string): Promise<void> {
  const user = await getCurrentUser();
  if (user) await invalidateUserSessions(user.id);
  redirect(`/${locale}/login`);
}

/**
 * Revoke one of your own sessions ("sign out this device"). Refuses the current
 * session — use `logout` for that so the cookies are cleared too. The session id
 * is a token *hash*, so passing it around is harmless.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  if (sessionId === (await currentSessionId())) return;
  await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));
  revalidatePath("/[locale]/account/security", "page");
}

/** Persist the signed-in user's theme preference (for cross-device sync). No-op when logged out. */
export async function updateTheme(theme: string): Promise<void> {
  if (!isTheme(theme)) return;
  const user = await getCurrentUser();
  if (!user) return;
  await db.update(users).set({ themePref: theme }).where(eq(users.id, user.id));
}

/** Edit your own profile (display name for now). */
export async function updateProfile(
  locale: string,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 80);
  await db
    .update(users)
    .set({ displayName: displayName || null })
    .where(eq(users.id, user.id));
  revalidatePath("/[locale]/account/profile", "page");
  return { ok: true };
}

/** Set a password for an OAuth-only account (one that has none yet). */
export async function setPassword(
  locale: string,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.passwordHash) return { error: "hasPassword" }; // use change-password instead

  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (next.length < 8) return { error: "passwordShort" };
  if (next !== confirm) return { error: "passwordMismatch" };

  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  await recordAudit("password.set", { actorId: user.id });
  revalidatePath("/[locale]/account/security", "page");
  return { ok: true };
}

/**
 * Self-service account deletion — removes the user (cascading their sessions) and
 * signs them out. Refuses if they're the **last admin** (they'd orphan the app);
 * the UI also disables the button in that case.
 */
export async function deleteMyAccount(locale: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role === "admin") {
    const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.role, "admin"));
    if (n <= 1) return;
  }
  await recordAudit("account.delete", { actorId: user.id, meta: { username: user.username } });
  await invalidateSession(); // clear this device's session + cookies
  await db.delete(users).where(eq(users.id, user.id)); // cascades any other sessions
  redirect(`/${locale}/login`);
}

const USERNAME_RE = /^[a-z0-9._-]+$/;

/** Public registration: consumes a valid invite code and creates the user with its role. */
export async function register(
  locale: string,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const code = String(formData.get("code") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!code) return { error: "codeMissing" };
  if (username.length < 3) return { error: "usernameShort" };
  if (!USERNAME_RE.test(username)) return { error: "usernameChars" };
  if (password.length < 8) return { error: "passwordShort" };

  const [invite] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.code, code))
    .limit(1);
  if (!invite || inviteStatus(invite) !== "active") return { error: "codeInvalid" };

  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (taken) return { error: "usernameTaken" };

  const passwordHash = await hashPassword(password);
  let userId: number;
  try {
    const [created] = await db
      .insert(users)
      .values({ username, passwordHash, role: invite.role })
      .returning({ id: users.id });
    userId = created.id;
  } catch {
    // Unique-index race on the username.
    return { error: "usernameTaken" };
  }

  // Atomically claim the invite. If it was used/revoked/expired in the race
  // window, undo the user we just created and reject.
  const now = new Date();
  const claimed = await db
    .update(invitations)
    .set({ usedAt: now, usedBy: userId })
    .where(
      and(
        eq(invitations.id, invite.id),
        isNull(invitations.usedAt),
        isNull(invitations.revokedAt),
        or(isNull(invitations.expiresAt), gt(invitations.expiresAt, now)),
      ),
    )
    .returning({ id: invitations.id });
  if (claimed.length === 0) {
    await db.delete(users).where(eq(users.id, userId));
    return { error: "codeInvalid" };
  }

  await createSession({ id: userId, username });
  redirect(`/${locale}`);
}

export type InviteState = { error?: string };

/** Admin-only: mint a single-use invite carrying `role`, optionally expiring. */
export async function createInvite(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  if (!(await can("invites:manage"))) return { error: "forbidden" };

  const role = String(formData.get("role") ?? "");
  if (!(["admin", "editor", "agent"] as const).includes(role as UserRole)) {
    return { error: "badRole" };
  }
  const days = Number(formData.get("expiresInDays"));
  const expiresAt = Number.isFinite(days) && days > 0
    ? new Date(Date.now() + days * 86_400_000)
    : null;

  const admin = await getCurrentUser();
  await db.insert(invitations).values({
    code: generateInviteCode(),
    role: role as UserRole,
    createdBy: admin?.id ?? null,
    expiresAt,
  });
  await recordAudit("invite.create", { actorId: admin?.id ?? null, meta: { role } });
  revalidatePath("/[locale]/account/admin/invites", "page");
  return {};
}

/** Admin-only: revoke an unused invite (bound to its id by the form). */
export async function revokeInvite(id: number): Promise<void> {
  const me = await getCurrentUser();
  if (!(await can("invites:manage"))) return;
  await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(and(eq(invitations.id, id), isNull(invitations.usedAt), isNull(invitations.revokedAt)));
  await recordAudit("invite.revoke", { actorId: me?.id ?? null, targetType: "invite", targetId: id });
  revalidatePath("/[locale]/account/admin/invites", "page");
}

/**
 * Admin-only: change a user's role. You can't change your **own** role — that
 * both prevents locking yourself out and guarantees at least one admin remains
 * (the acting admin).
 */
export async function setUserRole(userId: number, formData: FormData): Promise<void> {
  if (!(await can("users:manage"))) return;
  const me = await getCurrentUser();
  if (!me || me.id === userId) return;
  const role = String(formData.get("role") ?? "");
  if (!(["admin", "editor", "agent"] as const).includes(role as UserRole)) return;
  await db.update(users).set({ role: role as UserRole }).where(eq(users.id, userId));
  await recordAudit("user.role", { actorId: me.id, targetType: "user", targetId: userId, meta: { role } });
  revalidatePath("/[locale]/account/admin/users", "page");
}

/** Admin-only: delete a user (cascades their sessions). You can't delete yourself. */
export async function deleteUser(userId: number): Promise<void> {
  if (!(await can("users:manage"))) return;
  const me = await getCurrentUser();
  if (!me || me.id === userId) return;
  await db.delete(users).where(eq(users.id, userId));
  await recordAudit("user.delete", { actorId: me.id, targetType: "user", targetId: userId });
  revalidatePath("/[locale]/account/admin/users", "page");
}

/**
 * Admin-only: force-log-out a user by dropping all their sessions. Their
 * next request fails validation. (Their non-httpOnly nav mirror cookie lives on
 * their own device, so their header may show a stale name until they reload —
 * harmless, the server denies them.)
 */
export async function forceLogoutUser(userId: number): Promise<void> {
  const me = await getCurrentUser();
  if (!(await can("users:manage"))) return;
  await deleteAllUserSessions(userId);
  await recordAudit("user.force_logout", { actorId: me?.id ?? null, targetType: "user", targetId: userId });
  revalidatePath("/[locale]/account/admin/users", "page");
}

/**
 * Unlink an OAuth provider from your own account. Refuses to remove your **only**
 * sign-in method (you must keep a password or at least one other provider), so
 * you can't lock yourself out.
 */
export async function unlinkAccount(provider: AuthProviderName): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const linked = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, user.id));
  const remaining =
    (user.passwordHash ? 1 : 0) + linked.filter((a) => a.provider !== provider).length;
  if (remaining < 1) return;
  await db
    .delete(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.provider, provider)));
  await recordAudit("account.unlink", { actorId: user.id, meta: { provider } });
  revalidatePath("/[locale]/account/security", "page");
}
