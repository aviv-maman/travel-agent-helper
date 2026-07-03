import { getTranslations } from "next-intl/server";
import { PROVIDERS, PROVIDER_LABEL } from "@/lib/auth/accounts";
import { ProviderIcon } from "./provider-icons";

/**
 * "Continue with Google / Microsoft" — full-page links to the auth backend's
 * OAuth start endpoints. The backend (separate Python service) runs the OAuth
 * dance and hands back a session (see docs/auth-backend-contract.md). Renders
 * nothing until `AUTH_BACKEND_URL` is configured.
 */
export async function OAuthButtons({
  locale,
  mode,
  code,
}: {
  locale: string;
  mode: "login" | "register";
  /** Invite code to carry through an invite-gated sign-up. */
  code?: string;
}) {
  const base = process.env.AUTH_BACKEND_URL;
  if (!base) return null;
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("orContinue")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-2">
        {PROVIDERS.map((provider) => {
          const params = new URLSearchParams({ mode, locale });
          if (code) params.set("code", code);
          return (
            <a
              key={provider}
              href={`${base}/auth/${provider}/start?${params.toString()}`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              <ProviderIcon provider={provider} />
              {t("continueWith", { provider: PROVIDER_LABEL[provider] })}
            </a>
          );
        })}
      </div>
    </div>
  );
}
