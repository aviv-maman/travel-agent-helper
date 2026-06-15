import { defineConfig } from "drizzle-kit";

// DATABASE_URL is auto-loaded from .env.local by Bun when running the db:* scripts.
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
