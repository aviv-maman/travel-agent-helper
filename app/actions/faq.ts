"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { faqs, type FaqAnswer } from "@/db/schema";
import { can } from "@/lib/auth";

/**
 * Editor+ CRUD for the FAQ page (the copy-to-client answers). App-managed
 * after bootstrap — the seed never overwrites this table. The UI only shows
 * the controls to permitted users; these re-checks are the security boundary.
 *
 * No `revalidatePath`: the page calls `router.refresh()` on success.
 */

export type FaqInput = {
  question: string;
  answers: { label: string; body: string }[];
};

export type SaveResult = { ok: true; id: number } | { error: "forbidden" | "invalid" | "offline" };
export type DeleteResult = { ok: true } | { error: "forbidden" | "invalid" | "offline" };

export async function saveFaqAction(id: number | null, input: FaqInput): Promise<SaveResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };

  const question = (input.question ?? "").trim().slice(0, 300);
  if (!question) return { error: "invalid" };
  if (!Array.isArray(input.answers) || input.answers.length === 0 || input.answers.length > 8) {
    return { error: "invalid" };
  }
  const answers: FaqAnswer[] = [];
  for (const a of input.answers) {
    const body = (a.body ?? "").trim().slice(0, 2000);
    if (!body) return { error: "invalid" };
    const label = (a.label ?? "").trim().slice(0, 120);
    answers.push(label ? { label, body } : { body });
  }

  try {
    if (id === null) {
      const [row] = await db
        .insert(faqs)
        .values({
          question,
          answers,
          sortOrder: sql`coalesce((select max(sort_order) + 1 from faqs), 0)`,
        })
        .returning({ id: faqs.id });
      return { ok: true, id: row.id };
    }
    const updated = await db
      .update(faqs)
      .set({ question, answers })
      .where(eq(faqs.id, id))
      .returning({ id: faqs.id });
    if (updated.length === 0) return { error: "invalid" };
    return { ok: true, id };
  } catch {
    return { error: "offline" };
  }
}

export async function deleteFaqAction(id: number): Promise<DeleteResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  try {
    const deleted = await db.delete(faqs).where(eq(faqs.id, id)).returning({ id: faqs.id });
    if (deleted.length === 0) return { error: "invalid" };
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}
