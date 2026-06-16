"use client";

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

const ORDER = ["light", "dark", "system"] as const;
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

export function ThemeToggle() {
  const t = useTranslations("nav");
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      {/* Icon-only trigger: the .dark class drives which glyph shows via CSS. */}
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="relative"
            aria-label={t("theme")}
          />
        }
      >
        <Sun className="size-4 rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute inset-0 m-auto size-4 rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as (typeof ORDER)[number])}
        >
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
  );
}
