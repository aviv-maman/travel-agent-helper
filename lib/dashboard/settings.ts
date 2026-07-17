import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { dashboardSettings } from "@/db/schema";
import { BANK_KEYS, EMPTY_BANK, type BankDetails, type BankKey } from "./bank";

/**
 * Per-user key/value store. For v1 it holds the bank-transfer details behind the
 * one-tap WhatsApp copy; future single settings can reuse the same table. The
 * keys/types live in ./bank so the client card can share them without importing
 * this server-only module.
 */

export { BANK_KEYS, type BankDetails, type BankKey } from "./bank";

/** The user's bank details, with any unset key defaulting to "". */
export async function getBankDetails(userId: number): Promise<BankDetails> {
  const rows = await db
    .select({ key: dashboardSettings.key, value: dashboardSettings.value })
    .from(dashboardSettings)
    .where(
      and(eq(dashboardSettings.userId, userId), inArray(dashboardSettings.key, [...BANK_KEYS])),
    );
  const out: BankDetails = { ...EMPTY_BANK };
  for (const r of rows) {
    if ((BANK_KEYS as readonly string[]).includes(r.key)) out[r.key as BankKey] = r.value;
  }
  return out;
}

/** Upsert the user's bank details (one row per key; neon-http has no txns). */
export async function setBankDetails(userId: number, details: BankDetails): Promise<void> {
  for (const key of BANK_KEYS) {
    const value = details[key] ?? "";
    await db
      .insert(dashboardSettings)
      .values({ userId, key, value })
      .onConflictDoUpdate({
        target: [dashboardSettings.userId, dashboardSettings.key],
        set: { value },
      });
  }
}
