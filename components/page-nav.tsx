"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";

const PAGES = [
  { segment: "commissions", emoji: "💰" },
  { segment: "transfers", emoji: "🚌" },
  { segment: "baggage", emoji: "🧳" },
  { segment: "cancellations", emoji: "❌" },
  { segment: "hotels", emoji: "🏨" },
] as const;

export function PageNav() {
  const t = useTranslations("tabs");
  const locale = useLocale();
  const segment = useSelectedLayoutSegment() ?? "hotels";

  return (
    <div className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto w-full max-w-5xl px-2 py-2 sm:px-4 sm:py-2.5">
        <NavigationMenu className="w-full max-w-full">
          <NavigationMenuList className="w-full justify-between gap-0 sm:w-auto sm:justify-start sm:gap-1">
            {PAGES.map(({ segment: value, emoji }) => {
              const active = segment === value;
              return (
                <NavigationMenuItem key={value}>
                  <Link
                    href={`/${locale}/${value}`}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-md px-2.5 py-1.5 text-center font-medium transition-colors sm:flex-row sm:gap-2 sm:px-3 sm:text-left",
                      active
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}>
                    <span className="text-lg sm:text-base" aria-hidden>
                      {emoji}
                    </span>
                    <span className="text-[0.65rem] leading-tight sm:text-sm">{t(value)}</span>
                  </Link>
                </NavigationMenuItem>
              );
            })}
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </div>
  );
}
