import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getCurrentUser()) redirect(`/${locale}/account`);
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <div className="mx-auto w-full max-w-sm py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("forgotTitle")}</CardTitle>
          <CardDescription>{t("forgotSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm locale={locale} />
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
