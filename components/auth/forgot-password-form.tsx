"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestPasswordReset, type ResetState } from "@/lib/auth/reset-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Request a password-reset link. The response is deliberately **neutral** — the
 * same "check your inbox" message whether or not the address exists — so it can't
 * be used to probe which emails are registered.
 */
export function ForgotPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<ResetState, FormData>(
    requestPasswordReset.bind(null, locale),
    {},
  );

  if (state.ok) {
    return <p className="text-sm text-muted-foreground">{t("resetSent")}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {state.error && <p className="text-sm text-destructive">{t("errMissingEmail")}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("sending") : t("sendResetLink")}
      </Button>
    </form>
  );
}
