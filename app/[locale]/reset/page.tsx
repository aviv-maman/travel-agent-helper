import { setRequestLocale, getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { locale } = await params;
  const { token: tokenParam } = await searchParams;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <div className="mx-auto w-full max-w-sm py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("resetTitle")}</CardTitle>
          <CardDescription>{t("resetSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {token ? (
            <ResetPasswordForm locale={locale} token={token} />
          ) : (
            <p className="text-sm text-destructive">{t("resetNoToken")}</p>
          )}
        </CardContent>
        <CardFooter>
          <Link href="/login" className="text-sm font-medium text-brand hover:underline">
            {t("backToLogin")}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
