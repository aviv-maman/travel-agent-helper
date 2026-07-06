"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetPassword, type ResetState } from "@/lib/auth/reset-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type T = ReturnType<typeof useTranslations<"auth">>;

function errorMessage(t: T, error: string): string {
  switch (error) {
    case "passwordShort":
      return t("errPasswordShort");
    case "passwordMismatch":
      return t("errPasswordMismatch");
    case "invalidToken":
      return t("resetInvalidToken");
    case "invalidCode":
      return t("errInvalidCode");
    default:
      return t("errInvalid");
  }
}

/** Set a new password from a reset link. `token` comes from the emailed URL. */
export function ResetPasswordForm({ locale, token }: { locale: string; token: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<ResetState, FormData>(
    resetPassword.bind(null, locale),
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">{t("newPassword")}</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      {/* Only relevant for accounts with 2FA; harmless to leave blank otherwise. */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">{t("resetTwoFactorLabel")}</Label>
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" />
      </div>
      {state.error && <p className="text-sm text-destructive">{errorMessage(t, state.error)}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("updating") : t("resetSubmit")}
      </Button>
    </form>
  );
}
