/**
 * Bank-detail keys and types, in one client-safe module (no DB import) so both
 * the server DAL (lib/dashboard/settings.ts) and the client card can share them.
 */

/** Bank-detail keys, in display order. */
export const BANK_KEYS = ["bank", "branch", "account", "beneficiary"] as const;
export type BankKey = (typeof BANK_KEYS)[number];
export type BankDetails = Record<BankKey, string>;

export const EMPTY_BANK: BankDetails = {
  bank: "",
  branch: "",
  account: "",
  beneficiary: "",
};

/** Whether any bank field carries a value (drives the empty state). */
export function hasBankDetails(d: BankDetails): boolean {
  return BANK_KEYS.some((k) => (d[k] ?? "").trim().length > 0);
}
