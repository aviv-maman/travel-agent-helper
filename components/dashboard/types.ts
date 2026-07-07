import type { DashboardTaskType, DashboardTaskStatus } from "@/db/schema";

/**
 * Client-facing task shape. The server page maps DB rows to this (timestamps as
 * ISO strings) before handing them to the client dashboard components.
 */
export type DashTask = {
  id: string;
  title: string;
  clientName: string | null;
  clientPhone: string | null;
  type: DashboardTaskType;
  supplierName: string | null;
  orderNumber: string | null;
  /** "yyyy-mm-dd" or null. */
  dueDate: string | null;
  notes: string | null;
  status: DashboardTaskStatus;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp or null. */
  completedAt: string | null;
};

export type TaskTypeValue = DashboardTaskType;
