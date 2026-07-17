/**
 * Bank-detail keys and types, in one client-safe module (no DB import) so both
 * the server DAL (lib/dashboard/settings.ts) and the client card can share them.
 */

/**
 * Bank-detail keys, in display order — beneficiary first (the top box), and
 * `iban` last: it addresses the same account as bank/branch/account above, but
 * is only used for incoming USD transfers, so it reads as a footnote to them
 * rather than a peer.
 */
export const BANK_KEYS = ["beneficiary", "bank", "branch", "account", "iban"] as const;
export type BankKey = (typeof BANK_KEYS)[number];
export type BankDetails = Record<BankKey, string>;

export const EMPTY_BANK: BankDetails = {
  bank: "",
  branch: "",
  account: "",
  beneficiary: "",
  iban: "",
};

/** Whether any bank field carries a value (drives the empty state). */
export function hasBankDetails(d: BankDetails): boolean {
  return BANK_KEYS.some((k) => (d[k] ?? "").trim().length > 0);
}
