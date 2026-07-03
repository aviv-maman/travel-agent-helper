"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { disableTotp, regenerateBackupCodes, type TotpState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BackupCodes } from "./backup-codes";

/** Enabled-state controls: regenerate backup codes, or disable 2FA. */
export function TotpManage({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("auth");
  const [regen, regenAction, regenPending] = useActionState<TotpState, FormData>(
    regenerateBackupCodes,
    {},
  );
  const [dis, disAction, disPending] = useActionState<TotpState, FormData>(disableTotp, {});

  return (
    <div className="flex flex-col gap-4">
      {regen.backupCodes && (
        <BackupCodes
          codes={regen.backupCodes}
          title={t("backupCodesTitle")}
          hint={t("regenerated")}
        />
      )}
      <form action={regenAction}>
        <Button type="submit" variant="outline" size="sm" disabled={regenPending}>
          {t("regenerate")}
        </Button>
      </form>

      <form action={disAction} className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">{t("disableHint")}</p>
        <div className="flex flex-wrap gap-2">
          <Input
            name="code"
            inputMode="numeric"
            placeholder={t("verifyCode")}
            className="max-w-40"
          />
          {hasPassword && (
            <Input
              name="password"
              type="password"
              placeholder={t("password")}
              autoComplete="current-password"
              className="max-w-40"
            />
          )}
          <Button type="submit" variant="destructive" size="sm" disabled={disPending}>
            {t("disable2fa")}
          </Button>
        </div>
        {dis.error && <p className="text-sm text-destructive">{t("errInvalidCode")}</p>}
      </form>
    </div>
  );
}
