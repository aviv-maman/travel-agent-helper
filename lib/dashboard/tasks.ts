import "server-only";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { dashboardTasks, type DashboardTask, type DashboardTaskType } from "@/db/schema";

/**
 * Data-access layer for dashboard task/follow-up items. Every read and write is
 * scoped to the owning `userId` (the dashboard is per-user, login-gated). The
 * caller (server actions in app/actions/dashboard.ts) resolves the user first.
 */

const ARCHIVE_AFTER_DAYS = 7;

export type NewTaskInput = {
  title: string;
  type: DashboardTaskType;
  clientName?: string | null;
  clientPhone?: string | null;
  supplierName?: string | null;
  orderNumber?: string | null;
  /** ISO date string "yyyy-mm-dd" or null. */
  dueDate?: string | null;
  notes?: string | null;
};

export type TaskPatch = Partial<NewTaskInput>;

/** A user's open items (today's tasks + pending follow-ups), oldest first. */
export async function listOpenTasks(userId: number): Promise<DashboardTask[]> {
  return db
    .select()
    .from(dashboardTasks)
    .where(and(eq(dashboardTasks.userId, userId), eq(dashboardTasks.status, "open")))
    .orderBy(dashboardTasks.createdAt);
}

/** Items completed but not yet archived (the last ~7 days), newest first. */
export async function listDoneTasks(userId: number): Promise<DashboardTask[]> {
  return db
    .select()
    .from(dashboardTasks)
    .where(and(eq(dashboardTasks.userId, userId), eq(dashboardTasks.status, "done")))
    .orderBy(desc(dashboardTasks.completedAt));
}

/** Insert a new item for `userId`; returns its uuid. */
export async function createTask(userId: number, input: NewTaskInput): Promise<string> {
  const [row] = await db
    .insert(dashboardTasks)
    .values({
      userId,
      title: input.title,
      type: input.type,
      clientName: input.clientName ?? null,
      clientPhone: input.clientPhone ?? null,
      supplierName: input.supplierName ?? null,
      orderNumber: input.orderNumber ?? null,
      dueDate: input.dueDate ?? null,
      notes: input.notes ?? null,
    })
    .returning({ id: dashboardTasks.id });
  return row.id;
}

/** Patch mutable fields of one of the user's items (ownership-scoped). */
export async function updateTask(userId: number, id: string, patch: TaskPatch): Promise<void> {
  const set: Partial<typeof dashboardTasks.$inferInsert> = {};
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.type !== undefined) set.type = patch.type;
  if (patch.clientName !== undefined) set.clientName = patch.clientName;
  if (patch.clientPhone !== undefined) set.clientPhone = patch.clientPhone;
  if (patch.supplierName !== undefined) set.supplierName = patch.supplierName;
  if (patch.orderNumber !== undefined) set.orderNumber = patch.orderNumber;
  if (patch.dueDate !== undefined) set.dueDate = patch.dueDate;
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (Object.keys(set).length === 0) return;
  await db
    .update(dashboardTasks)
    .set(set)
    .where(and(eq(dashboardTasks.id, id), eq(dashboardTasks.userId, userId)));
}

/** Mark an item done (stamps `completedAt`). */
export async function completeTask(userId: number, id: string): Promise<void> {
  await db
    .update(dashboardTasks)
    .set({ status: "done", completedAt: new Date() })
    .where(and(eq(dashboardTasks.id, id), eq(dashboardTasks.userId, userId)));
}

/** Move a completed item back to open. */
export async function reopenTask(userId: number, id: string): Promise<void> {
  await db
    .update(dashboardTasks)
    .set({ status: "open", completedAt: null })
    .where(and(eq(dashboardTasks.id, id), eq(dashboardTasks.userId, userId)));
}

/** Permanently delete one of the user's items. */
export async function deleteTask(userId: number, id: string): Promise<void> {
  await db
    .delete(dashboardTasks)
    .where(and(eq(dashboardTasks.id, id), eq(dashboardTasks.userId, userId)));
}

/** Flip `done` items completed more than 7 days ago to `archived` (housekeeping). */
export async function archiveStaleCompleted(userId: number): Promise<void> {
  const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 86_400_000);
  await db
    .update(dashboardTasks)
    .set({ status: "archived" })
    .where(
      and(
        eq(dashboardTasks.userId, userId),
        eq(dashboardTasks.status, "done"),
        lt(dashboardTasks.completedAt, cutoff),
      ),
    );
}
