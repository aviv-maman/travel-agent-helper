"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { airlines, contacts, suppliers } from "@/db/schema";
import { can } from "@/lib/auth";
import { sectionForType, type ContactGroup } from "@/lib/contacts";
import { cleanContactGroups } from "@/lib/supplier-validation";

export type SaveContactsResult = { ok: true } | { error: "forbidden" | "invalid" | "offline" };

/**
 * Editor+ replacement of one supplier's/airline's contact list (the shared
 * team phonebook). The UI only shows the edit button to permitted users, but
 * this re-check is the real security boundary. `id` is the supplier slug, or
 * `air:{slug}` for an airline. The rows are replaced wholesale — the dialog
 * always submits the full list.
 *
 * No `revalidatePath`: the dialog calls `router.refresh()` on success (the
 * dashboard convention), which re-renders with fresh data and keeps the scroll.
 */
export async function saveContactsAction(
  id: string,
  groups: ContactGroup[],
): Promise<SaveContactsResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };

  // Validate before touching the DB; mirror the dialog's own filtering.
  const clean = cleanContactGroups(groups);
  if (clean === null) return { error: "invalid" };

  try {
    const owner = id.startsWith("air:")
      ? await db.query.airlines
          .findFirst({ where: eq(airlines.slug, id.slice(4)) })
          .then((a) => (a ? { airlineId: a.id, where: eq(contacts.airlineId, a.id) } : null))
      : await db.query.suppliers
          .findFirst({ where: eq(suppliers.slug, id) })
          .then((s) => (s ? { supplierId: s.id, where: eq(contacts.supplierId, s.id) } : null));
    if (!owner) return { error: "invalid" };

    const { where, ...ownerIds } = owner;
    await db.delete(contacts).where(where);
    if (clean.length) {
      await db.insert(contacts).values(
        clean.map((g, i) => ({
          ...ownerIds,
          section: sectionForType(g.type),
          type: g.type,
          label: g.label,
          phone: g.phone ?? "",
          email: g.email ?? "",
          active: g.active,
          sortOrder: i,
        })),
      );
    }
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}
