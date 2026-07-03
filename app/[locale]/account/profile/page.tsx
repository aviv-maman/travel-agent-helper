import type { ReactNode } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/auth/profile-form";
import { DeleteAccountButton } from "@/components/auth/delete-account-button";
import { LogoutButton } from "@/components/auth/logout-button";
import { UserAvatar } from "@/components/auth/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations({ locale, namespace: "account" });
  const tAuth = await getTranslations({ locale, namespace: "auth" });
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  let isLastAdmin = false;
  if (user.role === "admin") {
    const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.role, "admin"));
    isLastAdmin = n <= 1;
  }

  const rows: { label: string; value: ReactNode }[] = [
    { label: tAuth("username"), value: user.username },
    { label: tAuth("role"), value: <Badge variant="outline">{tAuth(`roles.${user.role}`)}</Badge> },
    { label: t("memberSince"), value: fmt.format(user.createdAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("profileTitle")}</CardTitle>
          <CardDescription>{t("profileSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <UserAvatar name={user.displayName || user.username} className="size-12 text-lg" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{user.displayName || user.username}</p>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            </div>
          </div>
          <ProfileForm locale={locale} defaultDisplayName={user.displayName ?? ""} />
          <dl className="flex flex-col gap-3 border-t border-border pt-4 text-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <LogoutButton locale={locale} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">{t("dangerZone")}</CardTitle>
          <CardDescription>{t("deleteHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountButton locale={locale} isLastAdmin={isLastAdmin} />
        </CardContent>
      </Card>
    </div>
  );
}
