import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, type Account, type AuthProviderName } from "@/db/schema";

/** Providers we support, in display order. */
export const PROVIDERS: readonly AuthProviderName[] = ["google", "microsoft"];

/** Human-readable provider names. */
export const PROVIDER_LABEL: Record<AuthProviderName, string> = {
  google: "Google",
  microsoft: "Microsoft",
};

/** All linked provider accounts for a user. */
export async function listAccounts(userId: number): Promise<Account[]> {
  return db.select().from(accounts).where(eq(accounts.userId, userId));
}
