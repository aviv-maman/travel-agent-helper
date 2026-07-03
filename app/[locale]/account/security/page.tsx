import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { listSessions, currentSessionId } from "@/lib/auth/session";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { SessionsList } from "@/components/auth/sessions-list";
import { LogoutEverywhereButton } from "@/components/auth/logout-everywhere-button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function SecurityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations({ locale, namespace: "auth" });
  const sessions = await listSessions(user.id);
  const sessionId = await currentSessionId();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("changePassword")}</CardTitle>
        </CardHeader>
        <CardContent className="max-w-sm">
          <ChangePasswordForm locale={locale} />
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
    </div>
  );
}
