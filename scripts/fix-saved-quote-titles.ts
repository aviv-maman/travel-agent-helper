/**
 * One-off repair: re-title saved quotes whose title is a bare confirmation
 * ("כן", "ok", …) — an artifact of the old title fallback that used the last
 * user prompt verbatim. Recomputes each with the current `buildQuoteTitle`.
 *
 * Usage: bun --env-file=.env.local scripts/fix-saved-quote-titles.ts [--apply]
 * Without --apply it only prints what would change.
 *
 * Uses @neondatabase/serverless directly (not `@/db`) so it runs outside Next —
 * the db module's import chain pulls in `server-only`.
 */
import { neon } from "@neondatabase/serverless";
import { buildQuoteTitle } from "../lib/ai/quote-title";

const CONFIRMATION_TITLE =
  /^(?:כן|לא|אוקי+|בסדר|סבבה|תודה(?: רבה)?|יאללה|קדימה|yes|no|ok(?:ay)?|sure|thanks?|thank you|go ahead|please)[\s.!]*$/i;

const apply = process.argv.includes("--apply");
const sql = neon(process.env.DATABASE_URL!);

const rows = (await sql`select id, title, prompt, content from saved_quotes order by id`) as {
  id: number;
  title: string;
  prompt: string;
  content: string;
}[];

let changed = 0;
for (const row of rows) {
  if (!CONFIRMATION_TITLE.test(row.title.trim())) continue;
  const next = buildQuoteTitle(row.prompt, row.content);
  if (next === row.title) continue;
  changed++;
  console.log(`#${row.id}: "${row.title}" -> "${next}"`);
  if (apply) await sql`update saved_quotes set title = ${next} where id = ${row.id}`;
}

console.log(
  changed === 0
    ? "Nothing to fix."
    : apply
      ? `Updated ${changed} quote(s).`
      : `${changed} quote(s) would change — rerun with --apply to write.`,
);
