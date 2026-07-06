import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { savedQuotes } from "@/db/schema";

/**
 * Persistence for **explicitly saved** quotes (the AI chat itself is ephemeral —
 * nothing is written until the agent clicks "Save"). The originating screenshot is
 * uploaded to R2 on save and referenced by `imageKey` (private; resolved through the
 * ownership-checked backend endpoint). Every read/write is scoped to the owning user.
 * See docs/ai-quote-assistant-contract.md.
 */

export type SavedQuote = {
  id: number;
  title: string;
  content: string;
  prompt: string;
  imageKey: string | null;
  imageMediaType: string | null;
  createdAt: Date;
};

export type SaveQuoteInput = {
  title: string;
  content: string;
  prompt: string;
  imageKey?: string | null;
  imageMediaType?: string | null;
};

/** The user's saved quotes, newest first, for the history list. */
export async function listSavedQuotes(userId: number): Promise<SavedQuote[]> {
  return db
    .select({
      id: savedQuotes.id,
      title: savedQuotes.title,
      content: savedQuotes.content,
      prompt: savedQuotes.prompt,
      imageKey: savedQuotes.imageKey,
      imageMediaType: savedQuotes.imageMediaType,
      createdAt: savedQuotes.createdAt,
    })
    .from(savedQuotes)
    .where(eq(savedQuotes.userId, userId))
    .orderBy(desc(savedQuotes.createdAt));
}

/** Persist a quote for `userId`; returns its new id. */
export async function saveQuote(userId: number, input: SaveQuoteInput): Promise<number> {
  const [row] = await db
    .insert(savedQuotes)
    .values({
      userId,
      title: input.title,
      content: input.content,
      prompt: input.prompt,
      imageKey: input.imageKey ?? null,
      imageMediaType: input.imageMediaType ?? null,
    })
    .returning({ id: savedQuotes.id });
  return row.id;
}

/** Delete one of the user's saved quotes (ownership-scoped). */
export async function deleteSavedQuote(userId: number, id: number): Promise<void> {
  await db.delete(savedQuotes).where(and(eq(savedQuotes.id, id), eq(savedQuotes.userId, userId)));
}
