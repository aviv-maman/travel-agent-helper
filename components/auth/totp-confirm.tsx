"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { confirmTotpSetup, type TotpState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BackupCodes } from "./backup-codes";

/** Step 2 of enrollment: verify a code, then reveal the backup codes once. */
export function TotpConfirm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<TotpState, FormData>(confirmTotpSetup, {});

  if (state.backupCodes) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-success">{t("twoFactorOn")}</p>
        <BackupCodes
          codes={state.backupCodes}
          title={t("backupCodesTitle")}
          hint={t("backupCodesHint")}
        />
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="totp-code">{t("verifyCode")}</Label>
        <Input
          id="totp-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          className="max-w-40 tracking-widest"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{t("errInvalidCode")}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("verifying") : t("confirm2fa")}
      </Button>
    </form>
  );
}
