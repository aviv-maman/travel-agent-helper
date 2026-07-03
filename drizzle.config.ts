import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

/**
 * The drizzle-kit CLI doesn't load `.env.local` on its own (Next.js and the bun
 * scripts do). Parse it here — zero-dependency — so `db:migrate` / `db:generate`
 * / `db:push` find DATABASE_URL regardless of the runner (bun or npm).
 */
if (!process.env.DATABASE_URL) {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local — fall back to the ambient environment
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local (see .env.example).");
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
