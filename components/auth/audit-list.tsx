import { getTranslations } from "next-intl/server";
import type { AuditRow } from "@/lib/auth/audit";

const ACTION_KEY: Record<string, string> = {
  login: "auditLogin",
  "password.change": "auditPasswordChange",
  "password.set": "auditPasswordSet",
  "password.reset": "auditPasswordReset",
  "email.verify": "auditEmailVerify",
  "account.delete": "auditAccountDelete",
  "account.unlink": "auditAccountUnlink",
  "2fa.enable": "audit2faEnable",
  "2fa.disable": "audit2faDisable",
  "passkey.add": "auditPasskeyAdd",
  "passkey.remove": "auditPasskeyRemove",
  "user.role": "auditUserRole",
  "user.delete": "auditUserDelete",
  "user.force_logout": "auditForceLogout",
  "invite.create": "auditInviteCreate",
  "invite.revoke": "auditInviteRevoke",
};

function detailOf(row: AuditRow): string {
  const parts: string[] = [];
  if (row.targetType && row.targetId != null) parts.push(`${row.targetType} #${row.targetId}`);
  if (row.meta) {
    for (const [key, value] of Object.entries(row.meta)) parts.push(`${key}: ${String(value)}`);
  }
  return parts.join(" · ");
}

/** Renders audit entries newest-first. `showActor` adds the acting user's name. */
export async function AuditList({
  rows,
  locale,
  showActor = false,
  emptyKey,
}: {
  rows: AuditRow[];
  locale: string;
  showActor?: boolean;
  emptyKey: string;
}) {
  const t0 = await getTranslations({ locale, namespace: "account" });
  // Action labels and the empty message are looked up by dynamic key.
  const t = t0 as unknown as (_key: string) => string;
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t(emptyKey)}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border text-sm">
      {rows.map((row) => {
        const key = ACTION_KEY[row.action];
        const detail = detailOf(row);
        return (
          <li
            key={row.id}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 first:pt-0">
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium text-foreground">{key ? t(key) : row.action}</span>
              {detail && <span className="text-muted-foreground">{detail}</span>}
            </span>
            <span className="flex items-baseline gap-2 text-xs text-muted-foreground">
              {showActor && <span>{row.actorUsername ?? "—"}</span>}
              <time dateTime={row.createdAt.toISOString()}>{fmt.format(row.createdAt)}</time>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
