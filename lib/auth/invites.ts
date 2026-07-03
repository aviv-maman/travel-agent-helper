import "server-only";
import { randomBytes } from "node:crypto";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { invitations, type Invitation } from "@/db/schema";

/** A URL-safe, unguessable invite code (~24 chars). */
export function generateInviteCode(): string {
  return randomBytes(18).toString("base64url");
}

export type InviteStatus = "active" | "used" | "revoked" | "expired";

/** Derived status for display and for gating registration. */
export function inviteStatus(invite: Invitation): InviteStatus {
  if (invite.revokedAt) return "revoked";
  if (invite.usedAt) return "used";
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return "expired";
  return "active";
}

/** Most-recent invites first, for the admin table. */
export async function listInvites(): Promise<Invitation[]> {
  return db.select().from(invitations).orderBy(desc(invitations.createdAt)).limit(100);
}
