import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth";
import { getUserDetail } from "@/lib/auth/users";
import { listActiveSessions } from "@/lib/auth/session";
import { describeUserAgent } from "@/components/auth/sessions-list";
import { UserAvatar } from "@/components/auth/user-avatar";
import { Link } from "@/i18n/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requirePermission("users:manage", locale);

  const userId = Number(id);
  if (!Number.isInteger(userId) || userId < 1) notFound();
  const user = await getUserDetail(userId);
  if (!user) notFound();

  const t = await getTranslations({ locale, namespace: "auth" });
  const tA = await getTranslations({ locale, namespace: "account" });
  const fmtDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const fmtDateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  const active = await listActiveSessions(userId);

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb — fed by the route: Users › {username}. */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/account/admin/users" className="hover:text-foreground">
          {tA("users")}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">{user.username}</span>
      </nav>

      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <UserAvatar name={user.username} className="size-10 text-sm" />
          <div>
            <CardTitle>{user.displayName || user.username}</CardTitle>
            <CardDescription>@{user.username}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{t("role")}</dt>
              <dd className="font-medium text-foreground">{t(`roles.${user.role}`)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{tA("memberSince")}</dt>
              <dd className="font-medium text-foreground">{fmtDate.format(user.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("twoFactor")}</dt>
              <dd className="font-medium text-foreground">
                {user.totpEnabledAt ? t("twoFactorOn") : t("twoFactorOff")}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("activeSessions")}</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tA("noSessions")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {active.map((session) => (
                <li key={session.id} className="px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {describeUserAgent(session.userAgent) || t("unknownDevice")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("lastActive", { date: fmtDateTime.format(session.lastSeenAt) })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
