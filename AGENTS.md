<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Repo conventions

- **Formatting** — Prettier with `prettier-plugin-tailwindcss` enforces LF (`endOfLine: "lf"`) and Tailwind class order; `.gitattributes` keeps checkouts LF on every platform. Run `bun run format` after edits; `bunx prettier --check "**/*.{ts,tsx}"` must pass. Vendored skills (`.agents/`, `.claude/skills/`) are excluded — never reformat them.
- **Loading states** — every route that awaits data has a `loading.tsx` Suspense fallback mirroring the real layout with `components/ui/skeleton` (see `app/[locale]/assistant/loading.tsx` for the pattern). Add one when creating a data-fetching route; account tabs get per-tab fallbacks so the tab nav stays mounted.
- **Errors** — `app/global-error.tsx` is the root boundary. It replaces the root layout, so it renders its own `<html>`/`<body>` and cannot use next-intl or the theme provider; its strings/theme handling are self-contained.
- **Checks** — `bun run typecheck` and `bunx eslint app components` must stay clean (5 pre-existing warnings are known).
