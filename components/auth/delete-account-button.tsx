"use client";

import { useTranslations } from "next-intl";
import { deleteMyAccount } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function DeleteAccountButton({
  locale,
  isLastAdmin,
}: {
  locale: string;
  isLastAdmin: boolean;
}) {
  const t = useTranslations("account");

  if (isLastAdmin) {
    return <p className="text-sm text-muted-foreground">{t("lastAdminNote")}</p>;
  }

  return (
    <form
      action={deleteMyAccount.bind(null, locale)}
      onSubmit={(e) => {
        if (!window.confirm(t("deleteConfirm"))) e.preventDefault();
      }}>
      <Button type="submit" variant="destructive">
        {t("deleteAccount")}
      </Button>
    </form>
  );
}
