"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { sendVerificationEmail } from "@/lib/auth/reset-actions";
import { Button } from "@/components/ui/button";

/**
 * Email-verification status + a "send link" button on Account → Security. The
 * send goes through the backend email transport; until Resend is wired it 503s,
 * so we show the neutral "if it's set up, we sent it" copy either way.
 */
export function EmailVerification({
  locale,
  email,
  verified,
}: {
  locale: string;
  email: string | null;
  verified: boolean;
}) {
  const t = useTranslations("auth");
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  if (!email) return <p className="text-sm text-muted-foreground">{t("emailNone")}</p>;
  if (verified) {
    return (
      <p className="flex items-center gap-2 text-sm text-success">
        <CheckCircle2 className="size-4" />
        {t("emailVerified", { email })}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{t("emailUnverified", { email })}</p>
      {sent ? (
        <p className="text-sm text-muted-foreground">{t("verifySent")}</p>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await sendVerificationEmail(locale);
              if (r.ok) setSent(true);
              else toast.error(t("errInvalid"));
            })
          }>
          {pending ? t("sending") : t("sendVerification")}
        </Button>
      )}
    </div>
  );
}
