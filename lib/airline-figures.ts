/**
 * Pure helpers for the airline table's numeric figures (suitcase kg, trolley kg,
 * commission %). Values are stored as bare numbers — "23", "7.5", or a slash
 * range like "15/23" / "0/5" — and the unit (ק"ג / kg / %) is presentation only.
 * Kept in its own module (no db/array imports) so the client inline editor can
 * share the exact validation the server action enforces.
 */

/** A bare numeric figure: "23", "7.5", or a slash range "15/23" / "0/5". */
export const FIGURE_RE = /^\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)*$/;

/**
 * Normalize user input to a bare figure: trims, drops spaces around "/", and
 * strips a unit the user typed anyway (%, ק"ג, kg) — the UI adds it back.
 */
export function bareFigure(input: string): string {
  return input
    .replace(/%/g, "")
    .replace(/ק["״']?ג/g, "")
    .replace(/kg/gi, "")
    .replace(/\s+/g, "");
}

/**
 * Display formatting for a commission figure: "%" per token — "0/5" → "0%/5%".
 * Idempotent (legacy rows stored as "7%" / "0%/5%" render unchanged); tokens
 * without a digit pass through untouched.
 */
export function withPercentTokens(value: string): string {
  return value
    .split("/")
    .map((p) => {
      const token = p.trim();
      return /\d/.test(token) ? `${token.replace(/%$/, "")}%` : token;
    })
    .join("/");
}
