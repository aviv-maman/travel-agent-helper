import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export type { Locale } from "./config";
export { localeDirection } from "./config";
