import { setRequestLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";
import { LogoutButton } from "@/components/auth/logout-button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
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

  return (
    <div className="mx-auto w-full max-w-sm py-8">
      <Card>
        <CardHeader>
          <CardTitle>{user ? t("accountTitle") : t("title")}</CardTitle>
          <CardDescription>{user ? t("accountSubtitle") : t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {t("signedInAs", { username: user.username, role: t(`roles.${user.role}`) })}
              </p>
              <LogoutButton locale={locale} />
            </div>
          ) : (
            <LoginForm locale={locale} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
