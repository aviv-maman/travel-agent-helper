import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getAiCredential } from "@/lib/ai/credentials";
import { backendUrl } from "@/lib/ai/backend";
import { ApiKeyForm } from "@/components/ai/api-key-form";
import { AiEnabledSync } from "@/components/ai/ai-enabled-sync";
import { Link } from "@/i18n/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default async function AiSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale);
  const t = await getTranslations({ locale, namespace: "ai" });
  const credential = await getAiCredential();
  const demo = backendUrl() === null;

  return (
    <div className="flex flex-col gap-6">
      {/* Keep the client nav mirror in sync with the true server state. */}
      <AiEnabledSync enabled={credential !== null} />

      <Card>
        <CardHeader>
          <CardTitle>{t("apiKeyTitle")}</CardTitle>
          <CardDescription>{t("apiKeyDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="max-w-md">
          <ApiKeyForm locale={locale} credential={credential} demo={demo} />
        </CardContent>
      </Card>

      {credential && (
        <Card>
          <CardHeader>
            <CardTitle>{t("readyTitle")}</CardTitle>
            <CardDescription>{t("readyDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/assistant" className={buttonVariants({ variant: "default" })}>
              {t("openAssistant")}
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
