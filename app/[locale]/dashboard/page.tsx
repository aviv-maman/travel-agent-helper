import { setRequestLocale } from "next-intl/server";
import { can, requireUser } from "@/lib/auth";
import type { DashboardTask } from "@/db/schema";
import { archiveStaleCompleted, listDoneTasks, listOpenTasks } from "@/lib/dashboard/tasks";
import { getScratchpad } from "@/lib/dashboard/scratchpad";
import { getBankDetails } from "@/lib/dashboard/settings";
import { greetingKey } from "@/lib/dashboard/dates";
import { getNews, getNewsSources } from "@/lib/news";
import type { DashTask } from "@/components/dashboard/types";
import { DashboardView } from "@/components/dashboard/dashboard-view";

/** Map a DB row to the client shape (timestamps as ISO strings). */
function toClient(t: DashboardTask): DashTask {
  return {
    id: t.id,
    title: t.title,
    clientName: t.clientName,
    clientPhone: t.clientPhone,
    type: t.type,
    supplierName: t.supplierName,
    orderNumber: t.orderNumber,
    dueDate: t.dueDate,
    notes: t.notes,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
  };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);

  // Housekeeping before reading, so the "done" list excludes just-archived items.
  await archiveStaleCompleted(user.id);
  // News rides along for the dashboard's News tab — the expensive source
  // fetches are cached (30 min) in lib/news.ts, so this is cheap per request.
  const [openTasks, doneTasks, scratchpad, bank, articles, canRefreshNews] = await Promise.all([
    listOpenTasks(user.id),
    listDoneTasks(user.id),
    getScratchpad(user.id),
    getBankDetails(user.id),
    getNews(locale),
    can("news:revalidate"),
  ]);

  return (
    <DashboardView
      tasks={openTasks.map(toClient)}
      doneTasks={doneTasks.map(toClient)}
      scratchpad={scratchpad}
      bank={bank}
      articles={articles}
      newsSources={getNewsSources(locale)}
      canRefreshNews={canRefreshNews}
      agentName={user.displayName?.trim() || user.username}
      greeting={greetingKey()}
    />
  );
}
