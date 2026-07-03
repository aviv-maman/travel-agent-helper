import { getTranslations } from "next-intl/server";
import type { SessionRow } from "@/lib/auth/session";
import { revokeSession } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

/** Best-effort friendly label from a user-agent string (no dependency). */
function describeUserAgent(ua: string | null): string {
  if (!ua) return "";
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "";
  const os =
    /Windows/.test(ua) ? "Windows"
    : /iPhone|iPad|iOS/.test(ua) ? "iOS"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /Linux/.test(ua) ? "Linux"
    : "";
  return [browser, os].filter(Boolean).join(" · ");
}

export async function SessionsList({
  sessions,
  currentSessionId,
  locale,
}: {
  sessions: SessionRow[];
  currentSessionId: string | null;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "auth" });
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
      {sessions.map((session) => {
        const isCurrent = session.id === currentSessionId;
        const label = describeUserAgent(session.userAgent) || t("unknownDevice");
        return (
          <li key={session.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {label}
                {isCurrent && (
                  <span className="ms-2 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                    {t("thisDevice")}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("lastActive", { date: fmt.format(session.lastSeenAt) })}
              </p>
            </div>
            {!isCurrent && (
              <form action={revokeSession.bind(null, session.id)}>
                <Button type="submit" variant="outline" size="sm">
                  {t("signOutDevice")}
                </Button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
