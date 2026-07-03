import { getTranslations } from "next-intl/server";
import type { UserRow } from "@/lib/auth/users";
import { setUserRole, deleteUser, forceLogoutUser } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export async function UsersTable({
  users,
  currentUserId,
  locale,
}: {
  users: UserRow[];
  currentUserId: number;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "auth" });
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const fmtDateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-start font-medium">{t("colUser")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("role")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("colCreated")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("colLastActive")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("colSessions")}</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <tr key={user.id} className="border-t border-border align-middle">
                <td className="px-3 py-2 font-medium text-foreground">
                  {user.username}
                  {isSelf && <span className="ms-1 text-xs text-muted-foreground">({t("you")})</span>}
                </td>
                <td className="px-3 py-2">
                  {isSelf ? (
                    t(`roles.${user.role}`)
                  ) : (
                    <form action={setUserRole.bind(null, user.id)} className="flex items-center gap-1.5">
                      <select
                        name="role"
                        defaultValue={user.role}
                        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                        <option value="agent">{t("roles.agent")}</option>
                        <option value="editor">{t("roles.editor")}</option>
                        <option value="admin">{t("roles.admin")}</option>
                      </select>
                      <Button type="submit" variant="outline" size="sm">
                        {t("save")}
                      </Button>
                    </form>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{fmt.format(user.createdAt)}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {user.lastActive ? fmtDateTime.format(user.lastActive) : "—"}
                </td>
                <td className="px-3 py-2">
                  {user.sessionCount > 0 && !isSelf && (
                    <form action={forceLogoutUser.bind(null, user.id)}>
                      <Button type="submit" variant="outline" size="sm">
                        {t("forceLogout", { count: user.sessionCount })}
                      </Button>
                    </form>
                  )}
                </td>
                <td className="px-3 py-2 text-end">
                  {!isSelf && (
                    <form action={deleteUser.bind(null, user.id)}>
                      <Button type="submit" variant="destructive" size="sm">
                        {t("delete")}
                      </Button>
                    </form>
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
