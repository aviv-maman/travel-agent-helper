"use client";

import { useTranslations } from "next-intl";
import { useSelectedLayoutSegments } from "next/navigation";
import { Link } from "@/i18n/navigation";
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
  canContent,
}: {
  canInvites: boolean;
  canUsers: boolean;
  canAudit: boolean;
  /** content:edit — shows the AI quote-commissions table editor. */
  canContent: boolean;
}) {
  const t = useTranslations("account");
  // Segments *below* the /account layout this nav lives in — e.g. ["profile"] or
  // ["admin", "users", "12"]. Prefix-matching against these keeps a tab lit on its
  // nested pages (the Users tab stays active on /account/admin/users/[id]), which an
  // exact pathname compare could not.
  const segments = useSelectedLayoutSegments();

  const tabs = [
    { href: "/account/profile", label: t("profile") },
    { href: "/account/security", label: t("security") },
    { href: "/account/ai", label: t("ai") },
    ...(canContent ? [{ href: "/account/quote-commissions", label: t("quoteCommissions") }] : []),
    ...(canInvites ? [{ href: "/account/admin/invites", label: t("invites") }] : []),
    ...(canUsers ? [{ href: "/account/admin/users", label: t("users") }] : []),
    ...(canAudit ? [{ href: "/account/admin/audit", label: t("audit") }] : []),
  ];

  const isActive = (href: string): boolean => {
    const tabSegments = href.replace(/^\/account\/?/, "").split("/").filter(Boolean);
    return tabSegments.every((seg, i) => segments[i] === seg);
  };

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border pb-2">
      {tabs.map((tab) => {
        const active = isActive(tab.href);
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
