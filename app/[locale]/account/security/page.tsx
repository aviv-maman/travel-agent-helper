import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { listSessions, currentSessionId } from "@/lib/auth/session";
import { listAudit } from "@/lib/auth/audit";
import { listPasskeys } from "@/lib/auth/passkeys";
import { PasskeysManage } from "@/components/auth/passkeys-manage";
import { EmailVerification } from "@/components/auth/email-verification";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { SessionsList } from "@/components/auth/sessions-list";
import { LogoutEverywhereButton } from "@/components/auth/logout-everywhere-button";
import { ConnectedAccounts } from "@/components/auth/connected-accounts";
import { TwoFactor } from "@/components/auth/two-factor";
import { AuditList } from "@/components/auth/audit-list";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default async function SecurityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ verified?: string }>;
}) {
  const { locale } = await params;
  const { verified } = await searchParams;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations({ locale, namespace: "auth" });
  const tAccount = await getTranslations({ locale, namespace: "account" });
  const sessions = await listSessions(user.id);
  const sessionId = await currentSessionId();
  const activity = await listAudit({ actorId: user.id, limit: 10 });
  const passkeys = await listPasskeys(user.id);

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
          <CardTitle>{t("twoFactor")}</CardTitle>
          <CardDescription>{t("twoFactorHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactor user={user} locale={locale} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("emailTitle")}</CardTitle>
          <CardDescription>{t("emailHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {verified === "1" && <p className="mb-2 text-sm text-success">{t("verifyDone")}</p>}
          <EmailVerification
            locale={locale}
            email={user.email}
            verified={user.emailVerifiedAt !== null}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("passkeys")}</CardTitle>
          <CardDescription>{t("passkeysHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PasskeysManage passkeys={passkeys} />
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
