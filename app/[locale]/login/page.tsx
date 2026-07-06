import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";
import { PasskeyLoginButton } from "@/components/auth/passkey-login-button";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Link } from "@/i18n/navigation";
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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { locale } = await params;
  const { next: nextParam } = await searchParams;
  const next = Array.isArray(nextParam) ? nextParam[0] : nextParam;
  setRequestLocale(locale);
  if (await getCurrentUser()) redirect(`/${locale}/account`);
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <div className="mx-auto w-full max-w-sm py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <LoginForm locale={locale} next={next} />
          <PasskeyLoginButton locale={locale} next={next} />
          <OAuthButtons locale={locale} mode="login" />
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            {t("haveInvite")}{" "}
            <Link href="/register" className="font-medium text-brand hover:underline">
              {t("register")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
