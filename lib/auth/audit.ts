import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";

/** Known audit actions (dotted keys map to i18n labels in the UI). */
export type AuditAction =
  | "login"
  | "password.change"
  | "password.set"
  | "password.reset"
  | "email.verify"
  | "email.change_requested"
  | "email.change"
  | "account.delete"
  | "account.unlink"
  | "2fa.enable"
  | "2fa.disable"
  | "passkey.add"
  | "passkey.remove"
  | "user.role"
  | "user.delete"
  | "user.force_logout"
  | "invite.create"
  | "invite.revoke";

/**
 * Append an audit entry. Best-effort: wrapped in try/catch so a logging failure
 * never breaks the action that triggered it. `actorId` defaults to the caller.
 */
export async function recordAudit(
  action: AuditAction,
  opts: {
    actorId?: number | null;
    targetType?: string;
    targetId?: number;
    meta?: Record<string, unknown>;
  } = {},
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorUserId: opts.actorId ?? null,
      action,
      targetType: opts.targetType ?? null,
      targetId: opts.targetId ?? null,
      meta: opts.meta ?? null,
    });
  } catch {
    // Never let auditing break the primary action.
  }
}

/** Most recent audit entries (all actors, or one when `actorId` is given), with actor username. */
export async function listAudit(opts: { actorId?: number; limit?: number } = {}) {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      meta: auditLog.meta,
      createdAt: auditLog.createdAt,
      actorUsername: users.username,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorUserId, users.id))
    .where(opts.actorId ? eq(auditLog.actorUserId, opts.actorId) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(opts.limit ?? 50);
}

export type AuditRow = Awaited<ReturnType<typeof listAudit>>[number];
