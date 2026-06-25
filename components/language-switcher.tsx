"use client";

import { useEffect, useTransition } from "react";
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

// Switching locale flips the page direction (rtl↔ltr), which re-resolves every
// logical margin/padding to the opposite side. Any element with a CSS
// transition animates that jump, so the whole page appears to flicker. We
// suppress transitions for the single frame the swap lands on, then restore.
const NO_TRANSITION_ID = "locale-switch-no-transition";

function suppressTransitions() {
  if (typeof document === "undefined" || document.getElementById(NO_TRANSITION_ID)) return;
  const style = document.createElement("style");
  style.id = NO_TRANSITION_ID;
  style.textContent = "*,*::before,*::after{transition:none!important;animation:none!important}";
  document.head.appendChild(style);
}

function restoreTransitions() {
  if (typeof document === "undefined") return;
  document.getElementById(NO_TRANSITION_ID)?.remove();
}

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Once the navigation settles, wait one painted frame (so the rtl↔ltr reflow
  // has happened with transitions off) before allowing transitions again.
  useEffect(() => {
    if (isPending) return;
    const id = requestAnimationFrame(restoreTransitions);
    return () => cancelAnimationFrame(id);
  }, [isPending]);
  return (
    <TooltipProvider>
      <Tooltip>
        <DropdownMenu modal={false}>
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
                onClick={() => {
                  suppressTransitions();
                  // Read the query imperatively (not via useSearchParams) so the
                  // switcher doesn't force a CSR bailout / Suspense boundary on
                  // every page during static prerendering.
                  const query = Object.fromEntries(
                    new URLSearchParams(window.location.search),
                  );
                  startTransition(() =>
                    router.replace({ pathname, query }, { locale: l }),
                  );
                }}
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
