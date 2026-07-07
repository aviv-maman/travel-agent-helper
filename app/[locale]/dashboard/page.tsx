import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import type { DashboardTask } from "@/db/schema";
import { archiveStaleCompleted, listDoneTasks, listOpenTasks } from "@/lib/dashboard/tasks";
import { getScratchpad } from "@/lib/dashboard/scratchpad";
import { getBankDetails } from "@/lib/dashboard/settings";
import { greetingKey } from "@/lib/dashboard/dates";
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
  const [openTasks, doneTasks, scratchpad, bank] = await Promise.all([
    listOpenTasks(user.id),
    listDoneTasks(user.id),
    getScratchpad(user.id),
    getBankDetails(user.id),
  ]);

  return (
    <DashboardView
      tasks={openTasks.map(toClient)}
      doneTasks={doneTasks.map(toClient)}
      scratchpad={scratchpad}
      bank={bank}
      agentName={user.displayName?.trim() || user.username}
      greeting={greetingKey()}
    />
  );
}
