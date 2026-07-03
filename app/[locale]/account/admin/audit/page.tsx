import { setRequestLocale, getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth";
import { listAudit } from "@/lib/auth/audit";
import { AuditList } from "@/components/auth/audit-list";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default async function AccountAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission("audit:read", locale);

  const t = await getTranslations({ locale, namespace: "account" });
  const rows = await listAudit({ limit: 100 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auditTitle")}</CardTitle>
        <CardDescription>{t("auditSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <AuditList rows={rows} locale={locale} showActor emptyKey="noAudit" />
      </CardContent>
    </Card>
  );
}
