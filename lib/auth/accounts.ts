import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, type Account, type AuthProviderName } from "@/db/schema";

/** Providers we support, in display order. */
export const PROVIDERS: readonly AuthProviderName[] = ["google", "microsoft"];

/**
 * Providers actually wired on the backend right now. Google is built; Microsoft
 * is a later follow-up. Override with the `AUTH_PROVIDERS` env (comma list) once
 * more providers exist, e.g. `AUTH_PROVIDERS="google,microsoft"`. Defaults to
 * Google so a not-yet-built provider never shows a button that would 503.
 */
export function enabledProviders(): AuthProviderName[] {
  const raw = process.env.AUTH_PROVIDERS?.trim();
  const wanted = raw ? raw.split(",").map((s) => s.trim().toLowerCase()) : ["google"];
  return PROVIDERS.filter((p) => wanted.includes(p));
}

/** Human-readable provider names. */
export const PROVIDER_LABEL: Record<AuthProviderName, string> = {
  google: "Google",
  microsoft: "Microsoft",
};

/** All linked provider accounts for a user. */
export async function listAccounts(userId: number): Promise<Account[]> {
  return db.select().from(accounts).where(eq(accounts.userId, userId));
}
