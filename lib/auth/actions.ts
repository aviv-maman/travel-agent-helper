"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "./password";
import { createSession, invalidateSession } from "./session";

export type AuthState = { error?: string };

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

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    return { error: "invalid" };
  }

  await createSession(user.id);
  redirect(`/${locale}`);
}

export async function logout(locale: string): Promise<void> {
  await invalidateSession();
  redirect(`/${locale}`);
}
