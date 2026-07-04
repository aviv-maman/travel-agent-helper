"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { verifyMfa, type AuthState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/** Second login step — TOTP or backup code. Shown after a correct password. */
export function MfaForm({ locale, next }: { locale: string; next?: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    verifyMfa.bind(null, locale),
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mfa-code">{t("mfaTitle")}</Label>
        <p className="text-sm text-muted-foreground">{t("mfaHint")}</p>
        <Input
          id="mfa-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          className="tracking-widest"
        />
      </div>
      {state.error && (
        <p className="text-sm text-destructive">
          {state.error === "expired" ? t("errMfaExpired") : t("errInvalidCode")}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("verifying") : t("verify")}
      </Button>
    </form>
  );
}
