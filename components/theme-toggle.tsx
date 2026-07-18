"use client";

import { useTheme } from "@/components/theme-provider";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** A single button that flips directly between light and dark (no system, no
 * dropdown) — the resolved theme decides which icon shows and which way to go. */
export function ThemeToggle() {
  const t = useTranslations("nav");
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="relative"
              aria-label={t("theme")}
              onClick={() => setTheme(isDark ? "light" : "dark")}
            />
          }>
          <Sun
            className={`size-4 transition-all duration-200 ${isDark ? "scale-0 -rotate-90" : "scale-100 rotate-0"}`}
          />
          <Moon
            className={`absolute inset-0 m-auto size-4 transition-all duration-200 ${isDark ? "scale-100 rotate-0" : "scale-0 rotate-90"}`}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("theme")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
