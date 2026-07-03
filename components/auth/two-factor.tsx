import { getTranslations } from "next-intl/server";
import type { User } from "@/db/schema";
import { otpauthURI } from "@/lib/auth/totp";
import { qrDataUri } from "@/lib/qr";
import { startTotpSetup, cancelTotpSetup } from "@/lib/auth/actions";
import { TotpConfirm } from "./totp-confirm";
import { TotpManage } from "./totp-manage";
import { CopyButton } from "./copy-button";
import { Button } from "@/components/ui/button";

const ISSUER = "Travel Agent Helper";

/** The 2FA section: enabled controls, mid-setup enrollment, or an enable button. */
export async function TwoFactor({ user, locale }: { user: User; locale: string }) {
  const t = await getTranslations({ locale, namespace: "auth" });

  // Enabled.
  if (user.totpEnabledAt) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-success">{t("twoFactorOn")}</p>
        <TotpManage hasPassword={user.passwordHash !== null} />
      </div>
    );
  }

  // Mid-setup: a secret exists but hasn't been confirmed.
  if (user.totpSecret) {
    const uri = otpauthURI({ secret: user.totpSecret, label: user.username, issuer: ISSUER });
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("setupScan")}</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- inline data-URI SVG, no remote fetch */}
        <img
          src={qrDataUri(uri)}
          alt=""
          width={176}
          height={176}
          className="h-44 w-44 self-start rounded-md border bg-white p-2"
        />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("secretLabel")}</span>
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 font-mono text-sm tracking-wide break-all">
              {user.totpSecret}
            </code>
            <CopyButton value={user.totpSecret} />
          </div>
        </div>
        <a href={uri} className="break-all text-xs text-brand hover:underline">
          {uri}
        </a>
        <TotpConfirm />
        <form action={cancelTotpSetup}>
          <Button type="submit" variant="ghost" size="sm" className="self-start">
            {t("cancel")}
          </Button>
        </form>
      </div>
    );
  }

  // Off.
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("twoFactorOff")}</p>
      <form action={startTotpSetup}>
        <Button type="submit" variant="outline" size="sm" className="self-start">
          {t("enable2fa")}
        </Button>
      </form>
    </div>
  );
}
