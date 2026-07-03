"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Tab nav for the /account area. Profile + Security always; the Admin group
 * (Invites, Users) only when the server layout says the user holds the
 * permission — the pages re-check server-side, so this is display-only.
 */
export function AccountNav({
  canInvites,
  canUsers,
  canAudit,
}: {
  canInvites: boolean;
  canUsers: boolean;
  canAudit: boolean;
}) {
  const t = useTranslations("account");
  const pathname = usePathname(); // locale-stripped, e.g. "/account/security"

  const tabs = [
    { href: "/account/profile", label: t("profile") },
    { href: "/account/security", label: t("security") },
    ...(canInvites ? [{ href: "/account/admin/invites", label: t("invites") }] : []),
    ...(canUsers ? [{ href: "/account/admin/users", label: t("users") }] : []),
    ...(canAudit ? [{ href: "/account/admin/audit", label: t("audit") }] : []),
  ];

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border pb-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
