import { setRequestLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { listSessions, currentSessionId } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { LogoutEverywhereButton } from "@/components/auth/logout-everywhere-button";
import { SessionsList } from "@/components/auth/sessions-list";
import { Link } from "@/i18n/navigation";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

// Reads the session cookie, so this route is always rendered per-request.
export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });
  const user = await getCurrentUser();
  const sessions = user ? await listSessions(user.id) : [];
  const sessionId = user ? await currentSessionId() : null;

  return (
    <div className={`mx-auto w-full py-8 ${user ? "max-w-md" : "max-w-sm"}`}>
      <Card>
        <CardHeader>
          <CardTitle>{user ? t("accountTitle") : t("title")}</CardTitle>
          <CardDescription>{user ? t("accountSubtitle") : t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {t("signedInAs", { username: user.username, role: t(`roles.${user.role}`) })}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <LogoutButton locale={locale} />
                  {user.role === "admin" && (
                    <>
                      <Link
                        href="/admin/invites"
                        className="text-sm font-medium text-brand hover:underline">
                        {t("manageInvites")}
                      </Link>
                      <Link
                        href="/admin/users"
                        className="text-sm font-medium text-brand hover:underline">
                        {t("manageUsers")}
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">{t("changePassword")}</h3>
                <ChangePasswordForm locale={locale} />
              </div>
              <Separator />
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">{t("activeSessions")}</h3>
                <SessionsList sessions={sessions} currentSessionId={sessionId} locale={locale} />
              </div>
              <Separator />
              <LogoutEverywhereButton locale={locale} />
            </div>
          ) : (
            <LoginForm locale={locale} />
          )}
        </CardContent>
        {!user && (
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              {t("haveInvite")}{" "}
              <Link href="/register" className="font-medium text-brand hover:underline">
                {t("register")}
              </Link>
            </p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
