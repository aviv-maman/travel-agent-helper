"use client";

import { useLocale, useTranslations } from "next-intl";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    <TooltipProvider>
      <Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <TooltipTrigger
                render={
                  <Button variant="outline" size="icon" aria-label={t("language")} />
                }
              />
            }>
            <CountryFlag code={localeCountry[locale]} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {routing.locales.map((l) => (
              <DropdownMenuItem
                key={l}
                onClick={() => router.replace(pathname, { locale: l })}
                className="gap-2">
                <CountryFlag code={localeCountry[l]} />
                {t(LABEL_KEY[l])}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipContent side="bottom">{t("language")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
