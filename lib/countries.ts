/**
 * Country list for the flag picker. Built from `Intl.DisplayNames` so we never
 * hand-maintain ~200 names: we walk every A–Z pair, keep the ones the runtime
 * recognises as a region, and resolve the name in both the active locale and
 * English (English is kept as an extra search key so typing "Israel" finds
 * ישראל). The 2-letter code drives the SVG flag via <CountryFlag>.
 */

export type Country = {
  /** ISO 3166-1 alpha-2, uppercase (e.g. "IL"). */
  code: string;
  /** Name in the active locale (e.g. "ישראל"). */
  name: string;
  /** Combined search key: local name + English name + code. */
  search: string;
};

// Aggregates / non-country regions that Intl still names — keep them out.
const EXCLUDE = new Set(["EU", "UN", "EZ", "QO", "ZZ", "XA", "XB", "XK"]);

/** All countries with localized names, sorted by the active-locale name. */
export function buildCountries(locale: string): Country[] {
  const local = new Intl.DisplayNames([locale], { type: "region", fallback: "none" });
  const english = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  const out: Country[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a) + String.fromCharCode(b);
      if (EXCLUDE.has(code)) continue;
      const name = local.of(code);
      if (!name || name === code) continue; // unassigned code
      const en = english.of(code) ?? name;
      out.push({ code, name, search: `${name} ${en} ${code}` });
    }
  }
  return out.sort((x, y) => x.name.localeCompare(y.name, locale));
}
