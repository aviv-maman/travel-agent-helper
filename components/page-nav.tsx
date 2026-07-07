"use client";

import { useMemo, useState } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Menu, CircleUser, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth/actions";
import { useAiEnabled } from "@/lib/ai/ai-enabled-store";
import { useSession } from "@/components/auth/session-provider";
import { UserAvatar } from "@/components/auth/user-avatar";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useDirection } from "@/components/ui/direction";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";

const PAGES = [
  { segment: "suppliers", emoji: "💰" },
  { segment: "transfers", emoji: "🚌" },
  { segment: "airlines", emoji: "✈️" },
  { segment: "cancellation-fees", emoji: "❌" },
  { segment: "hotels", emoji: "🏨" },
  { segment: "news", emoji: "📰" },
] as const;

export function PageNav() {
  const t = useTranslations("tabs");
  const tNav = useTranslations("nav");
  const tApp = useTranslations("app");
  const tAuth = useTranslations("auth");
  const user = useSession();
  const locale = useLocale();
  const direction = useDirection();
  const segment = useSelectedLayoutSegment() ?? "hotels";
  const aiEnabled = useAiEnabled();
  const [open, setOpen] = useState(false);
  // Prefer the display name over the username; CSS-truncated to 16ch in the nav.
  const userLabel = user ? user.displayName?.trim() || user.username : "";

  // The Assistant tab is revealed only once the user has a stored AI key
  // (contract §Access). Signed-in + key-configured, mirrored client-side so the
  // root layout needn't read the session (which would make public pages dynamic).
  const pages = useMemo(
    () =>
      user && aiEnabled
        ? [...PAGES, { segment: "assistant", emoji: "🤖" } as const]
        : PAGES,
    [user, aiEnabled],
  );

  // `segment` is the route segment directly under the [locale] layout: a content
  // page ("hotels", "news", …) or the account area ("account"). Only content pages
  // have an entry here — elsewhere there's none, so the mobile header falls back to
  // the app title instead of a stray page (previously it defaulted to "news").
  const active = pages.find((p) => p.segment === segment);
  // Signed in → the account area; signed out → login.
  const accountHref = user ? `/${locale}/account` : `/${locale}/login`;

  return (
    <div className="sticky top-0 z-50 border-b border-border bg-background/60 backdrop-blur-xs">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-2.5">
        {/* Mobile: hamburger + current page */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                className="sm:hidden"
                aria-label={tNav("menu")}
              />
            }>
            <Menu className="size-4" />
          </SheetTrigger>
          <SheetContent
            side={direction === "rtl" ? "right" : "left"}
            className="w-72 max-w-[80vw] gap-0 p-0">
            <SheetHeader className="p-4">
              <SheetTitle>{tApp("title")}</SheetTitle>
            </SheetHeader>
            <Separator />
            <nav className="flex flex-col gap-1 p-2">
              {pages.map(({ segment: value, emoji }) => {
                const isActive = segment === value;
                return (
                  <SheetClose
                    key={value}
                    nativeButton={false}
                    render={
                      <Link
                        href={`/${locale}/${value}`}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-foreground/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      />
                    }>
                    <span className="text-lg" aria-hidden>
                      {emoji}
                    </span>
                    {t(value)}
                  </SheetClose>
                );
              })}
            </nav>
            <Separator />
            <div className="flex flex-col gap-3 p-4">
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    href={accountHref}
                    className="flex items-center gap-3 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  />
                }>
                {user ? (
                  <UserAvatar name={userLabel} className="size-6 text-[0.6rem]" />
                ) : (
                  <CircleUser className="size-4" />
                )}
                {user ? (
                  <span className="max-w-[16ch] truncate">{userLabel}</span>
                ) : (
                  tNav("account")
                )}
              </SheetClose>
              {user && (
                <form action={logout.bind(null, locale)}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start px-0 text-muted-foreground">
                    <LogOut className="size-4" />
                    {tAuth("signOut")}
                  </Button>
                </form>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">{tNav("themeLabel")}</span>
                <ThemeToggle />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">{tNav("language")}</span>
                <LanguageSwitcher />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <span className="flex items-center gap-2 font-medium text-foreground sm:hidden">
          {active ? (
            <>
              <span className="text-lg" aria-hidden>
                {active.emoji}
              </span>
              {t(active.segment)}
            </>
          ) : (
            tApp("title")
          )}
        </span>

        {/* Desktop: horizontal page links */}
        <NavigationMenu className="hidden max-w-full flex-none sm:flex">
          <NavigationMenuList className="justify-start gap-1">
            {pages.map(({ segment: value, emoji }) => {
              const isActive = segment === value;
              return (
                <NavigationMenuItem key={value}>
                  <Link
                    href={`/${locale}/${value}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}>
                    <span className="text-base" aria-hidden>
                      {emoji}
                    </span>
                    {t(value)}
                  </Link>
                </NavigationMenuItem>
              );
            })}
          </NavigationMenuList>
        </NavigationMenu>

        {/* Desktop controls cluster */}
        <div className="ms-auto hidden shrink-0 items-center gap-2 sm:flex">
          {user ? (
            <>
              <Link
                href={accountHref}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-foreground transition-colors hover:text-brand">
                <UserAvatar name={userLabel} className="size-6 text-[0.6rem]" />
                <span className="max-w-[16ch] truncate">{userLabel}</span>
              </Link>
              <form action={logout.bind(null, locale)}>
                <Button type="submit" variant="ghost" size="icon-sm" aria-label={tAuth("signOut")}>
                  <LogOut className="size-4" />
                </Button>
              </form>
            </>
          ) : (
            <Link
              href={`/${locale}/login`}
              aria-label={tNav("account")}
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
              <CircleUser className="size-5" />
            </Link>
          )}
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
