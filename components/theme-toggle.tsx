"use client";

import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { useTranslations } from "next-intl";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ORDER = ["light", "dark", "system"] as const;
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

export function ThemeToggle() {
  const t = useTranslations("nav");
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider>
      <Tooltip>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger
            render={
              <TooltipTrigger
                render={
                  <Button variant="outline" size="icon" className="relative" aria-label={t("theme")} />
                }
              />
            }>
            <Sun
              className={`size-4 transition-all duration-200 ${theme === "light" ? "scale-100 rotate-0" : "scale-0 -rotate-90"}`}
            />
            <Moon
              className={`absolute inset-0 m-auto size-4 transition-all duration-200 ${theme === "dark" ? "scale-100 rotate-0" : "scale-0 rotate-90"}`}
            />
            <Monitor
              className={`absolute inset-0 m-auto size-4 transition-all duration-200 ${theme === "system" ? "scale-100 rotate-0" : "scale-0 rotate-90"}`}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => {
                setTheme(value as (typeof ORDER)[number]);
                setOpen(false);
              }}>
              {ORDER.map((value) => {
                const Icon = ICONS[value];
                return (
                  <DropdownMenuRadioItem key={value} value={value} className="gap-2">
                    <Icon className="size-4" />
                    {t(value)}
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipContent side="bottom">{t("theme")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
