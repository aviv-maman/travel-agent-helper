"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import type { DashboardTaskType } from "@/db/schema";
import {
  archiveStaleCompleted,
  completeTask,
  createTask,
  deleteTask,
  reopenTask,
  updateTask,
  type NewTaskInput,
  type TaskPatch,
} from "@/lib/dashboard/tasks";
import { upsertScratchpad } from "@/lib/dashboard/scratchpad";
import { setBankDetails, type BankDetails } from "@/lib/dashboard/settings";

/**
 * Server actions for the login-gated dashboard. Every action re-resolves the
 * session (the real security boundary) and writes through the per-user DAL, then
 * revalidates the dashboard route so the RSC render reflects the change. The
 * scratchpad save deliberately does NOT revalidate — its text is client-owned
 * and auto-saves while typing, so a refresh mid-edit would be disruptive.
 */

export type ActionResult = { ok: true } | { error: "forbidden" | "invalid" | "offline" };
export type CreateResult = { ok: true; id: string } | { error: "forbidden" | "invalid" | "offline" };

const TASK_TYPES: readonly DashboardTaskType[] = [
  "task",
  "awaiting_supplier",
  "client_followup",
  "reminder",
];

const DASHBOARD_PATH = "/[locale]/dashboard";

/** Trim and collapse an optional field to `null` when blank. */
function clean(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length ? s : null;
}

export async function createTaskAction(input: NewTaskInput): Promise<CreateResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "forbidden" };
  const title = (input.title ?? "").trim();
  if (!title || !TASK_TYPES.includes(input.type)) return { error: "invalid" };
  try {
    const id = await createTask(user.id, {
      title,
      type: input.type,
      clientName: clean(input.clientName),
      clientPhone: clean(input.clientPhone),
      supplierName: clean(input.supplierName),
      orderNumber: clean(input.orderNumber),
      dueDate: clean(input.dueDate),
      notes: clean(input.notes),
    });
    revalidatePath(DASHBOARD_PATH, "page");
    return { ok: true, id };
  } catch {
    return { error: "offline" };
  }
}

export async function updateTaskAction(id: string, patch: TaskPatch): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "forbidden" };
  if (patch.type !== undefined && !TASK_TYPES.includes(patch.type)) return { error: "invalid" };
  if (patch.title !== undefined && !patch.title.trim()) return { error: "invalid" };
  try {
    await updateTask(user.id, id, {
      ...patch,
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.clientName !== undefined ? { clientName: clean(patch.clientName) } : {}),
      ...(patch.clientPhone !== undefined ? { clientPhone: clean(patch.clientPhone) } : {}),
      ...(patch.supplierName !== undefined ? { supplierName: clean(patch.supplierName) } : {}),
      ...(patch.orderNumber !== undefined ? { orderNumber: clean(patch.orderNumber) } : {}),
      ...(patch.dueDate !== undefined ? { dueDate: clean(patch.dueDate) } : {}),
      ...(patch.notes !== undefined ? { notes: clean(patch.notes) } : {}),
    });
    revalidatePath(DASHBOARD_PATH, "page");
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}

export async function completeTaskAction(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "forbidden" };
  try {
    await completeTask(user.id, id);
    revalidatePath(DASHBOARD_PATH, "page");
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}

export async function reopenTaskAction(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "forbidden" };
  try {
    await reopenTask(user.id, id);
    revalidatePath(DASHBOARD_PATH, "page");
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "forbidden" };
  try {
    await deleteTask(user.id, id);
    revalidatePath(DASHBOARD_PATH, "page");
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}

export async function saveScratchpadAction(content: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "forbidden" };
  try {
    await upsertScratchpad(user.id, content);
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}

export async function saveBankDetailsAction(details: BankDetails): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "forbidden" };
  try {
    await setBankDetails(user.id, {
      bank: (details.bank ?? "").trim(),
      branch: (details.branch ?? "").trim(),
      account: (details.account ?? "").trim(),
      beneficiary: (details.beneficiary ?? "").trim(),
    });
    revalidatePath(DASHBOARD_PATH, "page");
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}

/** Housekeeping: archive stale completed items. Called from the page on load. */
export async function archiveStaleForCurrentUser(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  try {
    await archiveStaleCompleted(user.id);
  } catch {
    /* best-effort housekeeping */
  }
}
