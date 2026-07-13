import { getTranslations } from "next-intl/server";
import type { Invitation } from "@/db/schema";
import { inviteStatus, type InviteStatus } from "@/lib/auth/invites";
import { revokeInvite } from "@/lib/auth/actions";
import { CopyButton } from "@/components/auth/copy-button";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/auth/action-form";

const STATUS_CLASS: Record<InviteStatus, string> = {
  active: "border-success/25 bg-success/10 text-success",
  used: "border-border bg-muted text-muted-foreground",
  revoked: "border-destructive/25 bg-destructive/10 text-destructive",
  expired: "border-gold/25 bg-gold/10 text-gold",
};

export async function InvitesTable({
  invites,
  locale,
}: {
  invites: Invitation[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "auth" });
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  if (invites.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noInvites")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-start font-medium">{t("colCode")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("role")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("colStatus")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("colExpires")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("colCreated")}</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {invites.map((invite) => {
            const status = inviteStatus(invite);
            return (
              <tr key={invite.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <code className="font-mono text-xs">{invite.code}</code>
                    <CopyButton value={invite.code} />
                  </div>
                </td>
                <td className="px-3 py-2">{t(`roles.${invite.role}`)}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
                    {t(`status.${status}`)}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {invite.expiresAt ? fmt.format(invite.expiresAt) : t("noExpiry")}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {fmt.format(invite.createdAt)}
                </td>
                <td className="px-3 py-2 text-end">
                  {status === "active" && (
                    <ActionForm
                      action={revokeInvite.bind(null, invite.id)}
                      successMessage={t("toastInviteRevoked")}
                      errorMessage={t("toastActionFailed")}>
                      <Button type="submit" variant="destructive" size="sm">
                        {t("revoke")}
                      </Button>
                    </ActionForm>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
