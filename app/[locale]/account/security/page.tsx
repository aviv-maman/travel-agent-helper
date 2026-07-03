import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { listSessions, currentSessionId } from "@/lib/auth/session";
import { listAudit } from "@/lib/auth/audit";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { SessionsList } from "@/components/auth/sessions-list";
import { LogoutEverywhereButton } from "@/components/auth/logout-everywhere-button";
import { ConnectedAccounts } from "@/components/auth/connected-accounts";
import { AuditList } from "@/components/auth/audit-list";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default async function SecurityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations({ locale, namespace: "auth" });
  const tAccount = await getTranslations({ locale, namespace: "account" });
  const sessions = await listSessions(user.id);
  const sessionId = await currentSessionId();
  const activity = await listAudit({ actorId: user.id, limit: 10 });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{user.passwordHash ? t("changePassword") : t("setPassword")}</CardTitle>
        </CardHeader>
        <CardContent className="max-w-sm">
          {user.passwordHash ? (
            <ChangePasswordForm locale={locale} />
          ) : (
            <SetPasswordForm locale={locale} />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("connectedAccounts")}</CardTitle>
          <CardDescription>{t("connectedHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectedAccounts
            userId={user.id}
            hasPassword={user.passwordHash !== null}
            locale={locale}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("activeSessions")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SessionsList sessions={sessions} currentSessionId={sessionId} locale={locale} />
          <LogoutEverywhereButton locale={locale} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{tAccount("recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditList rows={activity} locale={locale} emptyKey="noActivity" />
        </CardContent>
      </Card>
    </div>
  );
}
