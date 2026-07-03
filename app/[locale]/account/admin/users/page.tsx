import { setRequestLocale, getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth";
import { listUsers } from "@/lib/auth/users";
import { UsersTable } from "@/components/auth/users-table";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function AccountUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await requirePermission("users:manage", locale);

  const t = await getTranslations({ locale, namespace: "auth" });
  const users = await listUsers();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("usersTitle")}</CardTitle>
          <CardDescription>{t("usersSubtitle")}</CardDescription>
        </CardHeader>
      </Card>
      <UsersTable users={users} currentUserId={me.id} locale={locale} />
    </div>
  );
}
