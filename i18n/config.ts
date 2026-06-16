/**
 * Single source of truth for the app's locales. Add a language here and the
 * routing, the `Localized` type, and the `localized()` helper all pick it up.
 */
export const locales = ["en", "he"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "he";

export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  he: "rtl",
  en: "ltr",
};

/** ISO 3166-1 country whose flag represents each locale in the switcher. */
export const localeCountry: Record<Locale, string> = {
  he: "IL",
  en: "GB",
};
