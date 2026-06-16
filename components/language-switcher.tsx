"use client";

import { useLocale, useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { localeCountry, type Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/country-flag";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LABEL_KEY: Record<Locale, "english" | "hebrew"> = {
  en: "english",
  he: "hebrew",
};

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" aria-label={t("language")} />
        }
      >
        <CountryFlag code={localeCountry[locale]} />
        {t(LABEL_KEY[locale])}
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => router.replace(pathname, { locale: l })}
            className="gap-2"
          >
            <CountryFlag code={localeCountry[l]} />
            {t(LABEL_KEY[l])}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
