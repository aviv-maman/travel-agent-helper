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
/** OAuth callback failures redirect back here with `?error=<code>`. */
const OAUTH_ERROR_KEYS: Record<string, string> = {
  no_account: "oauthErrNoAccount",
  oauth_denied: "oauthErrDenied",
  oauth_state: "oauthErrGeneric",
  oauth_failed: "oauthErrGeneric",
  oauth_link_signin: "oauthErrLinkSignin",
};

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const { locale } = await params;
  const { next: nextParam, error: errorParam } = await searchParams;
  const next = Array.isArray(nextParam) ? nextParam[0] : nextParam;
  const errorCode = Array.isArray(errorParam) ? errorParam[0] : errorParam;
  setRequestLocale(locale);
  if (await getCurrentUser()) redirect(`/${locale}/account`);
  const t = await getTranslations({ locale, namespace: "auth" });
  const oauthError = errorCode ? OAUTH_ERROR_KEYS[errorCode] : undefined;

  return (
    <div className="mx-auto w-full max-w-sm py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {oauthError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t(oauthError as Parameters<typeof t>[0])}
            </p>
          )}
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
