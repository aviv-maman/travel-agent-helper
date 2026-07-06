"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { passkeyLoginOptions, passkeyLogin } from "@/lib/auth/passkey-actions";

/**
 * One-click "Sign in with a passkey" on the login page. Uses discoverable
 * credentials — the browser/OS shows the user their passkeys for this site, so
 * no username is typed. On success the server action creates a fully
 * authenticated session (no TOTP step) and redirects.
 */
export function PasskeyLoginButton({ locale, next }: { locale: string; next?: string }) {
  const t = useTranslations("auth");
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const { options } = await passkeyLoginOptions();
      const response = await startAuthentication({ optionsJSON: options });
      const result = await passkeyLogin(locale, next ?? "", response);
      // On success the action redirects (throws) — reaching here means failure.
      if (result?.error) toast.error(t("passkeyLoginError"));
    } catch (err) {
      // Redirect bubbles as an error we must re-throw; user-cancel is silent.
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
      if (!(err instanceof Error && err.name === "NotAllowedError")) {
        toast.error(t("passkeyLoginError"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" className="w-full" onClick={handleClick} disabled={busy}>
      <KeyRound className="size-4" />
      {t("passkeyLogin")}
    </Button>
  );
}
