import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { confirmEmailVerification } from "@/lib/auth/reset-actions";
import { Link } from "@/i18n/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

/**
 * Confirms an email-verification link. Consuming the token is a write, so it runs
 * in a Server Action (a GET page must not mutate on render): the link lands here,
 * the user clicks "Confirm", the action consumes the token and redirects to the
 * result. `?error=1` after a failed confirm (bad / expired / used token).
 */
export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[]; error?: string }>;
}) {
  const { locale } = await params;
  const { token: tokenParam, error } = await searchParams;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  async function confirm() {
    "use server";
    const ok = token ? await confirmEmailVerification(token) : false;
    redirect(ok ? `/${locale}/account/security?verified=1` : `/${locale}/verify?error=1`);
  }

  return (
    <div className="mx-auto w-full max-w-sm py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("verifyTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!token ? (
            <p className="text-sm text-destructive">{t("verifyNoToken")}</p>
          ) : error ? (
            <p className="text-sm text-destructive">{t("verifyFailed")}</p>
          ) : (
            <form action={confirm} className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t("verifyPrompt")}</p>
              <button
                type="submit"
                className={buttonVariants({ variant: "default" }) + " self-start"}>
                {t("verifyConfirm")}
              </button>
            </form>
          )}
        </CardContent>
        <CardFooter>
          <Link href="/account/security" className={buttonVariants({ variant: "link" })}>
            {t("backToSecurity")}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
