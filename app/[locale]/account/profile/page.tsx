import type { ReactNode } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";
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

  const rows: { label: string; value: ReactNode }[] = [
    { label: tAuth("username"), value: user.username },
    { label: tAuth("role"), value: <Badge variant="outline">{tAuth(`roles.${user.role}`)}</Badge> },
    { label: t("memberSince"), value: fmt.format(user.createdAt) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profileTitle")}</CardTitle>
        <CardDescription>{t("profileSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="flex flex-col gap-3 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-medium text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="pt-1">
          <LogoutButton locale={locale} />
        </div>
      </CardContent>
    </Card>
  );
}
