import { getTranslations } from "next-intl/server";
import { listAccounts, enabledProviders, PROVIDER_LABEL } from "@/lib/auth/accounts";
import { unlinkAccount } from "@/lib/auth/actions";
import { ProviderIcon } from "./provider-icons";
import { Button } from "@/components/ui/button";

/**
 * Lists each supported provider as linked (with email + Disconnect) or not
 * linked (Connect → the auth backend in link mode). Disconnect is blocked when
 * it would leave the user with no way to sign in (server also re-checks).
 */
export async function ConnectedAccounts({
  userId,
  hasPassword,
  locale,
}: {
  userId: number;
  hasPassword: boolean;
  locale: string;
}) {
  const base = process.env.AUTH_BACKEND_URL;
  const t = await getTranslations({ locale, namespace: "auth" });
  const linked = await listAccounts(userId);
  const byProvider = new Map(linked.map((a) => [a.provider, a]));
  // Show a row for every enabled provider, plus any already-linked provider
  // (so a link stays visible/disconnectable even if it's later disabled).
  const rows = [...new Set([...enabledProviders(), ...linked.map((a) => a.provider)])];

  return (
    <ul className="flex flex-col divide-y divide-border">
      {rows.map((provider) => {
        const account = byProvider.get(provider);
        // Removing this one must leave at least one sign-in method.
        const canUnlink = hasPassword || linked.length > 1;
        return (
          <li key={provider} className="flex items-center justify-between gap-3 py-3 first:pt-0">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <ProviderIcon provider={provider} />
              <span className="font-medium text-foreground">{PROVIDER_LABEL[provider]}</span>
              {account?.email && (
                <span className="truncate text-muted-foreground">{account.email}</span>
              )}
            </span>
            {account ? (
              <form action={unlinkAccount.bind(null, provider)}>
                <Button type="submit" variant="outline" size="sm" disabled={!canUnlink}>
                  {t("disconnect")}
                </Button>
              </form>
            ) : base ? (
              <a
                href={`${base}/auth/${provider}/start?mode=link&locale=${locale}`}
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                {t("connect")}
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">{t("connectUnavailable")}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
