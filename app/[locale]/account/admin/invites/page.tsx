import { setRequestLocale, getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth";
import { listInvites } from "@/lib/auth/invites";
import { CreateInviteForm } from "@/components/auth/create-invite-form";
import { InvitesTable } from "@/components/auth/invites-table";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default async function AccountInvitesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Security boundary: only invite-managers may see or use this page.
  await requirePermission("invites:manage", locale);

  const t = await getTranslations({ locale, namespace: "auth" });
  const invites = await listInvites();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("invitesTitle")}</CardTitle>
          <CardDescription>{t("invitesSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateInviteForm />
        </CardContent>
      </Card>
      <InvitesTable invites={invites} locale={locale} />
    </div>
  );
}
